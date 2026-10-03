import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, Equals } from 'class-validator';
import { NormalizedEmail, PhoneField, TrimmedString } from '../../common/dto/decorators.js';
import { IMAGE_REF } from '../../custom/dto/custom.dto.js';
import { TICKET_KINDS } from '../support.rules.js';

export const MAX_TICKET_ATTACHMENTS = 4;

/** Empty string from an optional form field means "not provided". */
const blank = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value));

export const AttachmentRefs = () =>
  applyDecorators(
    IsOptional(),
    IsArray(),
    ArrayMaxSize(MAX_TICKET_ATTACHMENTS, { message: `Add up to ${MAX_TICKET_ATTACHMENTS} photos.` }),
    Matches(IMAGE_REF, { each: true, message: 'Each photo must be an uploaded image' }),
    MaxLength(500, { each: true }),
  );

/** Body of `POST /support/tickets`: the contact, grievance, takedown and data-request forms. */
export class CreateTicketDto {
  @IsIn([...TICKET_KINDS])
  kind!: (typeof TICKET_KINDS)[number];

  @TrimmedString(2, 80)
  name!: string;

  @NormalizedEmail()
  email!: string;

  @blank()
  @IsOptional()
  @PhoneField()
  phone?: string;

  /** One of the topics for the kind (validated in the service, which knows the lists). */
  @TrimmedString(1, 40)
  category!: string;

  /** An order (FB-1001) or work order (WO-001) number this is about. Linked only when it belongs to the sender. */
  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  reference?: string;

  @TrimmedString(10, 3000)
  message!: string;

  @AttachmentRefs()
  attachments?: string[];

  /** The sender confirmed they have read the privacy notice shown on the form. */
  @IsBoolean()
  @Equals(true, { message: 'Please confirm you have read the privacy notice' })
  consent!: boolean;

  /** Honeypot: hidden in the form, so only a bot fills it. A ticket that has it is dropped without a sound. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class TicketMessageDto {
  @TrimmedString(1, 3000)
  body!: string;

  @AttachmentRefs()
  attachments?: string[];
}

export class TicketTokenQuery {
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-f0-9]{16,100}$/, { message: 'Invalid link' })
  t!: string;
}
