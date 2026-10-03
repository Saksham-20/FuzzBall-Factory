import { Transform, Type } from 'class-transformer';
import { Equals, IsBoolean, IsDate, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizedEmail, PhoneField, TrimmedString } from '../../common/dto/decorators.js';
import { AttachmentRefs } from '../../support/dto/support.dto.js';
import { TICKET_CHANNELS, TICKET_KINDS, TICKET_STATUSES } from '../../support/support.rules.js';

const blank = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value));

export class SupportListQuery {
  @blank()
  @IsOptional()
  @IsIn([...TICKET_STATUSES, 'ACTIVE'])
  status?: (typeof TICKET_STATUSES)[number] | 'ACTIVE';

  @blank()
  @IsOptional()
  @IsIn([...TICKET_KINDS])
  kind?: (typeof TICKET_KINDS)[number];

  /** `overdue` and `due-soon` look at both clocks of the tickets still open. */
  @blank()
  @IsOptional()
  @IsIn(['overdue', 'due-soon', 'unacknowledged'])
  filter?: 'overdue' | 'due-soon' | 'unacknowledged';

  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class RegisterQuery {
  @blank()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @blank()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

/** A ticket the maker logs by hand: a WhatsApp chat, a phone call, a letter, an email. */
export class LogTicketDto {
  @IsIn([...TICKET_KINDS])
  kind!: (typeof TICKET_KINDS)[number];

  @IsIn([...TICKET_CHANNELS])
  channel!: (typeof TICKET_CHANNELS)[number];

  @TrimmedString(2, 80)
  name!: string;

  @blank()
  @IsOptional()
  @NormalizedEmail()
  email?: string;

  @blank()
  @IsOptional()
  @PhoneField()
  phone?: string;

  @TrimmedString(1, 40)
  category!: string;

  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  reference?: string;

  /** What the customer said, as close to their words as you can. */
  @TrimmedString(3, 3000)
  message!: string;

  /** When they really wrote. Their clocks start then. Defaults to now. */
  @blank()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  receivedAt?: Date;

  /** True when you already answered them on that channel, so no "we got your request" email goes out. */
  @IsBoolean()
  alreadyAcknowledged!: boolean;
}

export class SupportReplyDto {
  @TrimmedString(1, 3000)
  body!: string;

  /** A private note: never shown to the customer, never emailed. */
  @IsBoolean()
  internal!: boolean;

  @AttachmentRefs()
  attachments?: string[];
}

export class SupportPatchDto {
  @blank()
  @IsOptional()
  @TrimmedString(1, 40)
  category?: string;

  @blank()
  @IsOptional()
  @IsIn(['OPEN', 'WAITING_CUSTOMER', 'CLOSED'])
  status?: 'OPEN' | 'WAITING_CUSTOMER' | 'CLOSED';

  /** An order or work-order number to link, or "" to unlink. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  reference?: string;
}

export class SupportResolveDto {
  /** What was done. Required: it is the resolution the register keeps, and the customer's email carries it. */
  @TrimmedString(3, 1500)
  note!: string;

  /** Email the customer. Default yes. */
  @IsBoolean()
  notify!: boolean;
}

export class AckDto {
  @Equals(true)
  acknowledged!: true;
}
