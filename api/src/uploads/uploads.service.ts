import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException, ErrorCode, validationFailed } from '../common/errors.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FOLDER_PATTERN, STORAGE_DRIVER, type StorageDriver } from './storage/storage.driver.js';
import { processImage } from './image.pipeline.js';

export interface UploadResult {
  url: string;
}

/** A customer may add this many images per day; the maker (admin) is not limited. */
export const UPLOADS_PER_DAY = 40;
/** An uploaded image nobody attached is deleted after this long. */
export const ORPHAN_AFTER_DAYS = 7;

const DAY_MS = 86_400_000;

/**
 * Validates, re-encodes and stores an image, and keeps the books on who uploaded what: uploads are recorded per user
 * (quota, ownership, orphan cleanup) and image URLs typed into other requests must point at our own storage.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get driver(): StorageDriver['name'] {
    return this.storage.name;
  }

  /** `file.buffer` is the raw upload (multer memory storage). `folder` groups files, e.g. "products" or "custom". */
  async uploadImage(file: { buffer: Buffer }, opts: { folder?: string } = {}): Promise<UploadResult & { key: string }> {
    const folder = opts.folder && FOLDER_PATTERN.test(opts.folder) ? opts.folder : 'misc';
    const image = await processImage(file.buffer);
    const stored = await this.storage.save({ buffer: image.buffer, contentType: image.contentType, extension: image.extension, folder });
    return { url: stored.url, key: stored.key };
  }

  /** 429 once a customer has uploaded too many images today. Check before doing the (expensive) image work. */
  async assertQuota(user: { userId: string; role: string }): Promise<void> {
    if (user.role === 'admin') return;
    const recent = await this.prisma.upload.count({ where: { userId: user.userId, createdAt: { gt: new Date(Date.now() - DAY_MS) } } });
    if (recent >= UPLOADS_PER_DAY) {
      throw new AppException(429, ErrorCode.RATE_LIMITED, `You've uploaded a lot of photos today. Try again tomorrow, or message us on WhatsApp.`);
    }
  }

  /** Writes down who uploaded a file. The maker's uploads are in use by definition (product and progress photos). */
  async record(user: { userId: string; role: string }, file: { url: string; key: string }): Promise<void> {
    await this.prisma.upload.create({ data: { userId: user.userId, url: file.url, key: file.key, attachedAt: user.role === 'admin' ? new Date() : null } });
  }

  /** Every URL must be a file this customer uploaded. Stops pointing a work order at someone else's photo or a tracking pixel. */
  async assertOwned(userId: string, urls: readonly string[], field: string): Promise<void> {
    const unique = [...new Set(urls)];
    if (unique.length === 0) return;
    const owned = await this.prisma.upload.findMany({ where: { userId, url: { in: unique } }, select: { url: true } });
    if (owned.length !== unique.length) throw validationFailed({ [field]: 'Use photos you uploaded here. Upload them again.' });
  }

  /** Marks files as used so the orphan sweep leaves them alone. */
  async markAttached(urls: readonly string[]): Promise<void> {
    if (urls.length === 0) return;
    await this.prisma.upload.updateMany({ where: { url: { in: [...urls] }, attachedAt: null }, data: { attachedAt: new Date() } });
  }

  /**
   * True for a URL that points into our own storage: `/uploads/...` on this API, the configured public API address, or
   * our Cloudinary cloud. The web app's own maker photos (`/maker/`) count in every environment (the starter shelf covers use them); in development its `/brand/` images count too.
   */
  isOwnStorageUrl(url: string): boolean {
    const clean = (path: string) => !path.includes('..') && !/[\s\\]/.test(path);
    if (url.startsWith('/')) {
      if (!clean(url)) return false;
      if (/^\/uploads\/[\w./-]+$/.test(url)) return true;
      if (/^\/maker\/[\w./-]+$/.test(url)) return true;
      return this.config.get('NODE_ENV', { infer: true }) !== 'production' && /^\/brand\/[\w./-]+$/.test(url);
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (!clean(parsed.pathname) || parsed.username || parsed.password) return false;
    const apiBase = this.config.get('API_PUBLIC_URL', { infer: true }) ?? `http://localhost:${this.config.get('PORT', { infer: true })}`;
    if (parsed.origin === new URL(apiBase).origin && parsed.pathname.startsWith('/uploads/')) return true;
    const cloudinary = this.config.get('CLOUDINARY_URL', { infer: true });
    if (cloudinary) {
      const cloud = new URL(cloudinary).hostname;
      if (parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' && parsed.pathname.startsWith(`/${cloud}/`)) return true;
    }
    return false;
  }

  /** For maker-supplied image fields (product and category photos, progress photos): reject anything off our storage. */
  assertOwnStorage(urls: readonly (string | undefined)[], field: string): void {
    if (urls.some((u) => u && !this.isOwnStorageUrl(u))) throw validationFailed({ [field]: 'Use an image uploaded through the app.' });
  }

  /** Deletes files uploaded more than `ORPHAN_AFTER_DAYS` ago that nothing ever used. Returns how many went. */
  async purgeOrphans(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - ORPHAN_AFTER_DAYS * DAY_MS);
    const orphans = await this.prisma.upload.findMany({ where: { attachedAt: null, createdAt: { lt: cutoff } }, select: { id: true, key: true }, take: 200 });
    let removed = 0;
    for (const o of orphans) {
      try {
        await this.storage.remove(o.key);
        await this.prisma.upload.delete({ where: { id: o.id } });
        removed += 1;
      } catch (err) {
        this.logger.warn(`Could not delete orphan upload ${o.id}: ${(err as Error).message}`); // stays; the next run retries
      }
    }
    return removed;
  }

  /** Deletes every file a user uploaded (storage and record). For account erasure; a file that cannot be deleted stays recorded (`failed` > 0) so the caller can try again later. */
  async deleteAllFor(userId: string): Promise<{ removed: number; failed: number }> {
    const rows = await this.prisma.upload.findMany({ where: { userId }, select: { id: true, key: true } });
    let removed = 0;
    for (const r of rows) {
      try {
        await this.storage.remove(r.key);
        await this.prisma.upload.delete({ where: { id: r.id } });
        removed += 1;
      } catch (err) {
        this.logger.warn(`Could not delete upload ${r.id} during erasure: ${(err as Error).message}`);
      }
    }
    return { removed, failed: rows.length - removed };
  }
}
