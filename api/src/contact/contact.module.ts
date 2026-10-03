import { Module } from '@nestjs/common';
import { SupportModule } from '../support/support.module.js';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';

@Module({ imports: [SupportModule], controllers: [ContactController], providers: [ContactService] })
export class ContactModule {}
