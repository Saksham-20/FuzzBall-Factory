import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { SettingsService } from './settings.service.js';
import type { StoreSettings } from './settings.types.js';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Public store settings (contact, shipping rates, COD rules, gift wrap). Nothing else in the Setting table is exposed. */
  @Public()
  @Header('Cache-Control', 'public, max-age=30')
  @Get()
  get(): Promise<StoreSettings> {
    return this.settings.getStoreSettings();
  }
}
