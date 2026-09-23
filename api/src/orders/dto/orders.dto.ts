import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { BooleanField, NormalizedEmail, PhoneField, TrimmedString } from '../../common/dto/decorators.js';
import { CountryField } from '../../pricing/dto/country.js';
import { CartLineDto, MAX_LINES } from '../../pricing/dto/quote.dto.js';

export const GIFT_NOTE_MAX = 200;

/** Trims; an empty string is allowed (unlike `TrimmedString`) for optional free-text fields. */
const trimmed = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export class ContactDto {
  @TrimmedString(2, 80)
  name!: string;

  @NormalizedEmail()
  email!: string;

  @PhoneField()
  phone!: string;
}

/** Web `Omit<Address, "id" | "label">`. */
export class ShippingAddressDto {
  @TrimmedString(2, 80)
  name!: string;

  @PhoneField()
  phone!: string;

  @TrimmedString(3, 200)
  line1!: string;

  @IsOptional()
  @trimmed()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @TrimmedString(2, 80)
  city!: string;

  @trimmed()
  @IsString()
  @MaxLength(80)
  state!: string;

  @TrimmedString(1, 12)
  postalCode!: string;

  @CountryField()
  country!: string;
}

/** `POST /orders` body: web `PlaceOrderInput`. Prices are NOT accepted: the server prices the lines itself. */
export class PlaceOrderDto {
  @IsArray()
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => CartLineDto)
  lines!: CartLineDto[];

  @ValidateNested()
  @Type(() => ContactDto)
  contact!: ContactDto;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  address!: ShippingAddressDto;

  @IsOptional()
  @BooleanField()
  giftWrap?: boolean;

  @IsOptional()
  @trimmed()
  @IsString()
  @MaxLength(GIFT_NOTE_MAX, { message: `Keep the note under ${GIFT_NOTE_MAX} characters.` })
  giftNote?: string;

  @IsOptional()
  @BooleanField()
  hidePrices?: boolean;

  @IsOptional()
  @TrimmedString(1, 40)
  coupon?: string;

  @IsIn(['RAZORPAY', 'COD'])
  paymentMethod!: 'RAZORPAY' | 'COD';

  @IsOptional()
  @BooleanField()
  saveAddress?: boolean;
}

export class TrackOrderDto {
  @TrimmedString(1, 20)
  number!: string;

  /** The phone number or email used at checkout. */
  @TrimmedString(1, 254)
  contact!: string;
}

export class CancelOrderDto {
  @IsOptional()
  @TrimmedString(1, 500)
  reason?: string;
}

export class ReturnOrderDto {
  @TrimmedString(1, 500)
  reason!: string;
}
