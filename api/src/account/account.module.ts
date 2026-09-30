import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UploadsModule } from '../uploads/uploads.module.js';
import { AccountController } from './account.controller.js';
import { AccountExportService } from './account-export.service.js';
import { AccountService } from './account.service.js';
import { ErasureService } from './erasure.service.js';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [AccountController],
  providers: [AccountService, AccountExportService, ErasureService],
  exports: [AccountService, ErasureService],
})
export class AccountModule {}
