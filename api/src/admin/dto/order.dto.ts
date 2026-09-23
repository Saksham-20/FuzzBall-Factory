import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ORDER_STATUSES } from './query.dto.js';

const blank = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value));

/** Move an order along its state machine. SHIPPED needs `courier` and `awb` (here or already on the order). */
export class OrderStatusDto {
  @IsIn(ORDER_STATUSES)
  status!: (typeof ORDER_STATUSES)[number];

  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  courier?: string;

  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  awb?: string;
}

export class OrderNotesDto {
  /** Admin-only notes. Empty string clears them. */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  notes!: string;
}
