import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

/** ISO 3166-1 alpha-2 (uppercased) or the literal "OTHER" used by the intl zone table. */
export const CountryField = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value)),
    Matches(/^([A-Z]{2}|OTHER)$/, { message: 'Use a 2-letter country code' }),
  );
