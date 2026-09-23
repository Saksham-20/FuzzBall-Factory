import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
import { PhoneField, TrimmedString } from '../../common/dto/decorators.js';

/** Image references: an uploaded URL (Cloudinary/https) or a same-site path (`/uploads/x.jpg`). */
export const IMAGE_REF = /^(https?:\/\/[^\s]+|\/[^\s/][^\s]*)$/;
export const MAX_REFERENCES = 5;

/** Empty string from an optional form field means "not provided". */
const blankToUndefined = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? value.trim() : value));

const ImageRefs = () =>
  applyDecorators(
    IsArray(),
    ArrayMaxSize(MAX_REFERENCES, { message: `Add up to ${MAX_REFERENCES} photos.` }),
    Matches(IMAGE_REF, { each: true, message: 'Each image must be an uploaded image URL' }),
    MaxLength(500, { each: true }),
  );

export class CreateCustomDto {
  @IsIn(['NEW', 'CUSTOMIZE'])
  kind!: 'NEW' | 'CUSTOMIZE';

  /** Slug of the shelf product being customised (kind CUSTOMIZE). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  baseProductSlug?: string;

  @TrimmedString(1, 60)
  category!: string;

  @TrimmedString(3, 60)
  title!: string;

  @TrimmedString(30, 2000)
  description!: string;

  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  colours!: string[];

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80, { message: 'Use at most 80 characters' })
  size!: string;

  @IsInt()
  @Min(1, { message: 'Enter how many you need, from 1 to 50.' })
  @Max(50, { message: 'For more than 50, message us on WhatsApp.' })
  quantity!: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  budgetMin!: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  budgetMax!: number;

  /** `yyyy-mm-dd` (or a full ISO date). Blank = no deadline. */
  @blankToUndefined()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/, { message: 'Use a date like 2026-12-31' })
  neededBy?: string;

  @blankToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  occasion?: string;

  @blankToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'Keep personalization under 60 characters.' })
  personalization?: string;

  @ImageRefs()
  references!: string[];

  @Matches(/^[A-Z]{2,5}$/, { message: 'Pick a country.' })
  country!: string;

  @TrimmedString(1, 12)
  postalCode!: string;

  @PhoneField()
  phone!: string;

  /** The "I understand: 50% advance…" checkbox. Omitted = accepted at submit (the form requires it). */
  @IsOptional()
  @IsBoolean()
  termsAccepted?: boolean;
}

export class MessageDto {
  @TrimmedString(1, 2000)
  body!: string;

  @IsOptional()
  @ImageRefs()
  attachments?: string[];
}

export class CounterDto {
  @IsInt({ message: 'Enter a whole number of rupees' })
  @Min(1, { message: 'Must be more than zero' })
  @Max(1_000_000)
  amount!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class DeclineQuoteDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RequestChangeDto {
  @TrimmedString(1, 1000)
  note!: string;
}

/** Nested validation helper reused by the admin quote DTO. */
export class BreakdownLineDto {
  @TrimmedString(1, 120)
  label!: string;

  @IsInt({ message: 'Use a whole number of rupees' })
  @Min(0, { message: 'Cannot be negative' })
  @Max(1_000_000)
  amount!: number;
}

export class QuoteInputDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BreakdownLineDto)
  breakdown!: BreakdownLineDto[];

  @IsInt()
  @Min(1)
  @Max(365)
  timelineDays!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  revisions!: number;

  @TrimmedString(1, 1500)
  scope!: string;

  /** Days the quote stays open. Default: `quoteValidityDays` from settings. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  validDays?: number;
}
