import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { TrimmedString } from '../../common/dto/decorators.js';

const rupees = () => applyDecorators(IsInt({ message: 'Use a whole number of rupees' }), Min(0), Max(1_000_000));

export class IntlZoneDto {
  @TrimmedString(1, 80)
  name!: string;

  /** ISO country codes, or `*` / `OTHER` for the catch-all zone. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(250)
  @Matches(/^([A-Z]{2}|\*|OTHER)$/, { each: true, message: 'Use ISO country codes like GB, or * for the rest of the world' })
  countries!: string[];

  @rupees()
  rate!: number;

  @TrimmedString(1, 40)
  days!: string;
}

/** Full replace of `StoreSettings` (web/src/lib/types.ts). */
export class SettingsInputDto {
  @Matches(/^\+?[0-9][0-9\s-]{6,18}$/, { message: 'Use digits with the country code, like 919876543210' })
  whatsapp!: string;

  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email!: string;

  @rupees()
  freeShippingAbove!: number;

  @rupees()
  domesticShipping!: number;

  @IsBoolean()
  codEnabled!: boolean;

  @rupees()
  codCap!: number;

  @rupees()
  codFee!: number;

  @rupees()
  giftWrapPrice!: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one shipping zone' })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => IntlZoneDto)
  intlZones!: IntlZoneDto[];

  @IsInt()
  @Min(1, { message: 'At least 1%' })
  @Max(100, { message: 'At most 100%' })
  depositPct!: number;

  @IsInt()
  @Min(1)
  @Max(60)
  quoteValidityDays!: number;
}

export class ReviewStatusDto {
  @IsIn(['PENDING', 'PUBLISHED', 'HIDDEN', 'DISPUTED'])
  status!: 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'DISPUTED';

  /** Required (and only stored) when `status` is DISPUTED: why the maker is contesting this review. */
  @ValidateIf((o: ReviewStatusDto) => o.status === 'DISPUTED')
  @TrimmedString(3, 300)
  disputeReason?: string;
}

export class ReviewReplyDto {
  @TrimmedString(1, 1000)
  reply!: string;
}
