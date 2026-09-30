import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator.js';
import { ContactDto } from './contact.dto.js';
import { ContactService } from './contact.service.js';

/** Five messages an hour per IP: plenty for a real person, and a flood cannot fill the maker's inbox. */
const HOURLY = { default: { limit: 5, ttl: 60 * 60_000 } };

@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Public()
  @Throttle(HOURLY)
  @HttpCode(204)
  @Post()
  async send(@Body() dto: ContactDto): Promise<void> {
    await this.contact.submit(dto);
  }
}
