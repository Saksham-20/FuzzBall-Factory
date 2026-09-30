import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

const trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value));

/** Refund a captured payment by hand. Leave `amount` out to refund whatever is left (whole rupees). */
export class RefundDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @trim()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason!: string;
}

export class PaymentListQuery {
  /** Order number, e.g. FB-1001. */
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  order?: string;

  /** Work order number, e.g. WO-001. */
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  request?: string;
}
