import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { CloudinaryDriver } from './storage/cloudinary.driver.js';
import { LocalDiskDriver } from './storage/local.driver.js';
import { STORAGE_DRIVER, type StorageDriver } from './storage/storage.driver.js';
import { UploadsController } from './uploads.controller.js';
import { UploadsService } from './uploads.service.js';

@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    {
      provide: STORAGE_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): StorageDriver => {
        const log = new Logger('Uploads');
        const cloudinaryUrl = config.get('CLOUDINARY_URL', { infer: true });
        if (cloudinaryUrl) {
          log.log('Storage driver: Cloudinary');
          return new CloudinaryDriver(cloudinaryUrl);
        }
        const base = config.get('API_PUBLIC_URL', { infer: true }) ?? `http://localhost:${config.get('PORT', { infer: true })}`;
        if (config.get('NODE_ENV', { infer: true }) === 'production') log.warn('Storage driver: local disk in production (no backup, no CDN). Set CLOUDINARY_URL before going live.');
        else log.log('Storage driver: local disk (set CLOUDINARY_URL to use Cloudinary)');
        return new LocalDiskDriver(config.get('UPLOADS_DIR', { infer: true }), base);
      },
    },
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
