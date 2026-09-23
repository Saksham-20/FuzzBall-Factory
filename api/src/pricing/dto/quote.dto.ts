import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { BooleanField, TrimmedString } from '../../common/dto/decorators.js';
import { CountryField } from './country.js';

export const MAX_LINES = 30;
export const MAX_QTY = 20;

export class CartLineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  productId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  variantId!: string;

  @IsInt({ message: 'Use a whole number' })
  @Min(1)
  @Max(MAX_QTY)
  qty!: number;

  @IsOptional()
  @TrimmedString(1, 200)
  personalization?: string;
}

/** `POST /checkout/quote` body: web `quote(lines, opts)` flattened into one object. */
export class QuoteDto {
  @IsArray()
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => CartLineDto)
  lines!: CartLineDto[];

  @CountryField()
  country!: string;

  @IsOptional()
  @BooleanField()
  giftWrap?: boolean;

  @IsOptional()
  @TrimmedString(1, 40)
  coupon?: string;

  @IsOptional()
  @IsIn(['RAZORPAY', 'COD'])
  paymentMethod?: 'RAZORPAY' | 'COD';
}

export class ValidateCouponDto {
  @TrimmedString(1, 40)
  code!: string;

  @IsArray()
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => CartLineDto)
  lines!: CartLineDto[];
}
