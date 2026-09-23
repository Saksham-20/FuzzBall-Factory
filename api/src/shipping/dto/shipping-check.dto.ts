import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { BooleanField } from '../../common/dto/decorators.js';
import { CountryField } from '../../pricing/dto/country.js';

/** `GET /shipping/check?country=IN&postalCode=560038&leadTimeDays=5&ready=true` (web `checkShipping`). */
export class ShippingCheckQueryDto {
  @CountryField()
  country!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(12)
  postalCode: string = '';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  leadTimeDays?: number;

  @IsOptional()
  @BooleanField()
  ready?: boolean;
}
