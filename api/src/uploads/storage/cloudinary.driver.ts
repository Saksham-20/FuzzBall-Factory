import cloudinaryPackage from 'cloudinary';
import { FOLDER_PATTERN, type StorageDriver, type StoredFile } from './storage.driver.js';

const cloudinary = cloudinaryPackage.v2;

/** Production driver. `CLOUDINARY_URL` looks like `cloudinary://<api_key>:<api_secret>@<cloud_name>`. */
export class CloudinaryDriver implements StorageDriver {
  readonly name = 'cloudinary' as const;

  constructor(cloudinaryUrl: string) {
    const u = new URL(cloudinaryUrl);
    cloudinary.config({ cloud_name: u.hostname, api_key: decodeURIComponent(u.username), api_secret: decodeURIComponent(u.password), secure: true });
  }

  save(input: { buffer: Buffer; contentType: string; extension: string; folder: string }): Promise<StoredFile> {
    if (!FOLDER_PATTERN.test(input.folder)) return Promise.reject(new Error(`Invalid upload folder "${input.folder}"`));
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: `fuzzball/${input.folder}`, resource_type: 'image', unique_filename: true, overwrite: false }, (err, res) => {
        if (err || !res) reject(err instanceof Error ? err : new Error('Cloudinary upload failed'));
        else resolve({ url: res.secure_url, key: res.public_id });
      });
      stream.end(input.buffer);
    });
  }
}
