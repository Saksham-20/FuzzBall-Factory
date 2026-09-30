import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const blank = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value));

export class AuditListQuery {
  /** Exact action, e.g. `payment.refund`. */
  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  action?: string;

  /** Entity type, e.g. `Order`, `Payment`, `Product`. */
  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  entity?: string;

  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityId?: string;

  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  actorId?: string;

  /** Cursor: the `nextCursor` of the previous page. */
  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  before?: string;

  @Transform(({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
