import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString, Matches, MaxLength, ArrayMaxSize } from 'class-validator';
import { TrimmedString } from '../../common/dto/decorators.js';
import { IMAGE_REF } from '../../custom/dto/custom.dto.js';

/** Optional free text: blank becomes "not provided". */
const OptionalText = (max: number) =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value)),
    IsOptional(),
    IsString(),
    MaxLength(max),
  );

/** Optional uploaded-image reference. */
const OptionalImage = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value)),
    IsOptional(),
    Matches(IMAGE_REF, { message: 'Photo must be an uploaded image URL' }),
    MaxLength(500),
  );

export class DeclineCustomDto {
  @TrimmedString(1, 500)
  reason!: string;
}

export class AdminMessageDto {
  @TrimmedString(1, 2000)
  body!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @Matches(IMAGE_REF, { each: true, message: 'Each attachment must be an uploaded image URL' })
  attachments?: string[];
}

export class ProgressDto {
  @TrimmedString(1, 500)
  note!: string;

  @OptionalImage()
  photo?: string;
}

export class ApprovalRequestDto {
  @OptionalText(500)
  note?: string;

  @OptionalImage()
  photo?: string;
}

export class ShipCustomDto {
  @TrimmedString(1, 60)
  courier!: string;

  @TrimmedString(1, 60)
  awb!: string;
}
