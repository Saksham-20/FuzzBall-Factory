import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module.js';
import { AccountTicketsController, SupportController } from './support.controller.js';
import { SupportService } from './support.service.js';

/** The support inbox: tickets from the website forms and from the maker's own log. The admin side lives in `AdminModule`. */
@Module({
  imports: [UploadsModule],
  controllers: [SupportController, AccountTicketsController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
