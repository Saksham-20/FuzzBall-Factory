import { Allow, IsBoolean, IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export const COUPON_CODE = /^[A-Z0-9_-]{3,32}$/;

export class CouponInputDto {
  /** Stored upper-case. On PUT it must match the URL (or be omitted). */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(COUPON_CODE, { message: 'Use 3-32 letters, numbers, dashes or underscores' })
  code!: string;

  @IsIn(['PERCENT', 'FLAT'])
  kind!: 'PERCENT' | 'FLAT';

  /** Percent (1-100) or flat rupees; the range is checked against `kind` in the service. */
  @IsInt({ message: 'Use a whole number' })
  @Min(1)
  @Max(100_000)
  value!: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  minCart!: number;

  @IsBoolean()
  active!: boolean;

  /** Read-only counter: echoed back by the client, ignored. */
  @Allow()
  uses?: unknown;

  /** ISO date/time. Omit or null for "never expires". */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/, { message: 'Use an ISO date like 2026-12-31' })
  expiresAt?: string | null;
}
