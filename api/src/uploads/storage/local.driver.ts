import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { FOLDER_PATTERN, type StorageDriver, type StoredFile } from './storage.driver.js';

/** Dev driver: files go to `<uploadsDir>/<folder>/<uuid>.<ext>` and are served by `UploadsController` at `/uploads/*`. */
export class LocalDiskDriver implements StorageDriver {
  readonly name = 'local' as const;
  readonly dir: string;

  constructor(
    uploadsDir: string | undefined,
    private readonly publicBaseUrl: string,
  ) {
    this.dir = resolve(uploadsDir ?? join(process.cwd(), 'uploads'));
  }

  async save(input: { buffer: Buffer; contentType: string; extension: string; folder: string }): Promise<StoredFile> {
    if (!FOLDER_PATTERN.test(input.folder)) throw new Error(`Invalid upload folder "${input.folder}"`);
    const file = `${randomUUID()}.${input.extension}`;
    const key = `${input.folder}/${file}`;
    await mkdir(join(this.dir, input.folder), { recursive: true });
    await writeFile(join(this.dir, key), input.buffer, { flag: 'wx' });
    return { key, url: `${this.publicBaseUrl.replace(/\/$/, '')}/uploads/${key}` };
  }

  async remove(key: string): Promise<void> {
    // Keys come from our own table, but never trust a path: only `<folder>/<uuid>.<ext>` inside the uploads dir.
    if (!/^[a-z0-9][a-z0-9-]{0,39}\/[a-f0-9-]{36}\.[a-z0-9]+$/.test(key)) return;
    await rm(join(this.dir, key), { force: true });
  }
}
