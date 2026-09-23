import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TrimmedString } from '../../common/dto/decorators.js';
import { IMAGE_REF } from '../../custom/dto/custom.dto.js';

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

const trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));
const Text = (max: number) => applyDecorators(trim(), IsString(), MaxLength(max, { message: `Use at most ${max} characters` }));
const TextList = (maxItems: number, maxLen: number) =>
  applyDecorators(
    IsArray(),
    ArrayMaxSize(maxItems),
    Transform(({ value }: { value: unknown }) => (Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim() : v)) : value)),
    IsString({ each: true }),
    MaxLength(maxLen, { each: true }),
  );

export class ProductImageDto {
  @trim()
  @Matches(IMAGE_REF, { message: 'Use an uploaded image URL' })
  @MaxLength(500)
  src!: string;

  @Text(200)
  alt!: string;
}

export class SwatchDto {
  @TrimmedString(1, 40)
  name!: string;

  @Matches(HEX, { message: 'Use a colour like #c9748f' })
  hex!: string;
}

export class VariantDto {
  /** Existing variant id: updated in place. Missing/unknown id: a new variant is created. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  id?: string;

  @TrimmedString(1, 40)
  colour!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;

  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  priceDelta!: number;

  @IsInt({ message: 'Use a whole number' })
  @Min(0, { message: 'Stock cannot be negative' })
  @Max(100_000)
  stock!: number;
}

/**
 * Body of create (POST) and full update (PUT) for a product: the web `Product` minus server-owned fields.
 * `id`, `batch`, `createdAt`, `rating`, `sample` may be echoed back by the client and are ignored.
 */
export class ProductInputDto {
  @Allow()
  id?: unknown;
  @Allow()
  batch?: unknown;
  @Allow()
  createdAt?: unknown;
  @Allow()
  rating?: unknown;
  @Allow()
  sample?: unknown;

  /** Optional: derived from the name on create; kept as-is on update when omitted. */
  @IsOptional()
  @trim()
  @Matches(SLUG, { message: 'Use lowercase letters, numbers and dashes' })
  @MaxLength(120)
  slug?: string;

  @TrimmedString(2, 120)
  name!: string;

  @Text(120)
  tagline!: string;

  @Text(4000)
  description!: string;

  /** Category slug. */
  @TrimmedString(1, 60)
  category!: string;

  @IsInt({ message: 'Use a whole number of rupees' })
  @Min(1, { message: 'Price must be at least ₹1' })
  @Max(1_000_000)
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  compareAtPrice?: number;

  @IsIn(['READY', 'MADE_TO_ORDER'])
  fulfilment!: 'READY' | 'MADE_TO_ORDER';

  @IsInt()
  @Min(0)
  @Max(120)
  leadTimeDays!: number;

  @Text(120)
  fiber!: string;

  @Text(80)
  sizeCm!: string;

  @IsInt()
  @Min(0)
  @Max(50_000)
  weightG!: number;

  @TextList(12, 300)
  care!: string[];

  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images!: ProductImageDto[];

  @IsArray()
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => SwatchDto)
  swatches!: SwatchDto[];

  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants!: VariantDto[];

  @IsBoolean()
  isOneOfAKind!: boolean;

  @IsBoolean()
  customizable!: boolean;

  @IsBoolean()
  giftable!: boolean;

  @TextList(10, 40)
  occasions!: string[];

  @TextList(20, 40)
  tags!: string[];

  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status!: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export class ProductStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids!: string[];

  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status!: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}
