/**
 * Where processed images end up. `UploadsService` doesn't know which driver is active:
 * Cloudinary when CLOUDINARY_URL is set (production), local disk otherwise (dev).
 */
export interface StoredFile {
  /** Absolute URL the browser can load. */
  url: string;
  /** Driver-specific identifier (Cloudinary public id, or the relative path on disk). */
  key: string;
}

export interface StorageDriver {
  readonly name: 'cloudinary' | 'local';
  /** Deletes a stored file by its driver key. Missing files are not an error. */
  remove(key: string): Promise<void>;
  save(input: { buffer: Buffer; contentType: string; extension: string; folder: string }): Promise<StoredFile>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

/** Folder names are used in paths and URLs: lowercase letters, digits and dashes only. */
export const FOLDER_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
