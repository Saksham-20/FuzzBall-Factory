import { Controller, Get, Inject, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { join } from 'node:path';
import { Public } from '../common/decorators/public.decorator.js';
import { badRequest, ErrorCode } from '../common/errors.js';
import { MAX_UPLOAD_BYTES } from './image.pipeline.js';
import type { LocalDiskDriver } from './storage/local.driver.js';
import { UploadsService, type UploadResult } from './uploads.service.js';
import { STORAGE_DRIVER, type StorageDriver } from './storage/storage.driver.js';

/** The bits of a multer memory-storage file this controller uses. */
interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const SAFE_FOLDER = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SAFE_FILE = /^[a-f0-9-]{36}\.webp$/;

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /**
   * `multipart/form-data` with one image in the `file` field. Any signed-in user (customers attach reference
   * images to custom requests, the admin uploads product photos). Max 8 MB; re-encoded to WebP, EXIF stripped, max 2000px.
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_TYPES.has(file.mimetype)) cb(null, true);
        else cb(badRequest('Upload a JPG, PNG or WebP image.', { file: 'Unsupported type' }, 'INVALID_IMAGE'), false);
      },
    }),
  )
  async upload(@UploadedFile() file: UploadedImage | undefined): Promise<UploadResult> {
    if (!file) throw badRequest('Choose an image to upload.', { file: 'Required' });
    return this.uploads.uploadImage(file, { folder: 'uploads' });
  }

  /**
   * Local-disk driver only (dev): serves stored files. Names are strictly validated (no traversal) and only
   * files we wrote (`<uuid>.webp`) are reachable. Cross-origin embedding is allowed so the web app's <img> works.
   */
  @Public()
  @SkipThrottle()
  @Get(':folder/:file')
  serve(@Param('folder') folder: string, @Param('file') file: string, @Res() res: Response): void {
    const notFound = () => res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "We couldn't find that." });
    if (this.storage.name !== 'local' || !SAFE_FOLDER.test(folder) || !SAFE_FILE.test(file)) return void notFound();
    const root = join((this.storage as LocalDiskDriver).dir, folder);
    res.sendFile(file, { root, dotfiles: 'deny', maxAge: '365d', immutable: true, headers: { 'Cross-Origin-Resource-Policy': 'cross-origin' } }, (err) => {
      if (err && !res.headersSent) notFound();
    });
  }
}
