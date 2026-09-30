import { Inject, Injectable } from '@nestjs/common';
import { FOLDER_PATTERN, STORAGE_DRIVER, type StorageDriver } from './storage/storage.driver.js';
import { processImage } from './image.pipeline.js';

export interface UploadResult {
  url: string;
}

/**
 * Validates, re-encodes and stores an image. Exported for other modules (the admin product-image and
 * custom-order reference uploads call `uploadImage` directly with a multer file).
 */
@Injectable()
export class UploadsService {
  constructor(@Inject(STORAGE_DRIVER) private readonly storage: StorageDriver) {}

  get driver(): StorageDriver['name'] {
    return this.storage.name;
  }

  /** `file.buffer` is the raw upload (multer memory storage). `folder` groups files, e.g. "products" or "custom". */
  async uploadImage(file: { buffer: Buffer }, opts: { folder?: string } = {}): Promise<UploadResult> {
    const folder = opts.folder && FOLDER_PATTERN.test(opts.folder) ? opts.folder : 'misc';
    const image = await processImage(file.buffer);
    const stored = await this.storage.save({ buffer: image.buffer, contentType: image.contentType, extension: image.extension, folder });
    return { url: stored.url };
  }
}
