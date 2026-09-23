import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { ShippingController } from './shipping.controller.js';
import { SHIPPING_PROVIDER, TableShippingProvider } from './shipping.provider.js';
import { ShippingService } from './shipping.service.js';

@Module({
  imports: [SettingsModule],
  controllers: [ShippingController],
  providers: [ShippingService, { provide: SHIPPING_PROVIDER, useClass: TableShippingProvider }],
  exports: [ShippingService],
})
export class ShippingModule {}
