import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const EMAIL_STATUSES = ['PENDING', 'SENDING', 'SENT', 'FAILED'] as const;

export class EmailListQuery {
  @IsOptional()
  @IsIn(EMAIL_STATUSES)
  status?: (typeof EMAIL_STATUSES)[number];

  @Transform(({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
