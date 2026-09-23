import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsString, MaxLength, MinLength, Validate, ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';
import { normalizePhone } from '../phone.js';

/** Email stored/looked-up in one canonical (trimmed, lowercase) form. */
export const NormalizedEmail = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    IsEmail({}, { message: 'Enter a valid email address' }),
    MaxLength(254),
  );

/** Human-readable text that must not be blank or whitespace-only. Trims before validating. */
export const TrimmedString = (min: number, max: number) =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)),
    IsString(),
    MinLength(min, { message: min === 1 ? 'Required' : `Use at least ${min} characters` }),
    MaxLength(max, { message: `Use at most ${max} characters` }),
  );

@ValidatorConstraint({ name: 'phone', async: false })
class PhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && normalizePhone(value) !== null;
  }
  defaultMessage() {
    return 'Enter a valid phone number';
  }
}

/** Phone number, normalised to +<digits> (10 digits => +91). Combine with `@IsOptional()` when optional. */
export const PhoneField = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? (normalizePhone(value) ?? value.trim()) : value)),
    Validate(PhoneConstraint),
  );

/**
 * Strict boolean. With plain @IsBoolean, query-string "false" is a truthy string; this accepts only
 * true/false/"true"/"false" and rejects everything else with a 400.
 */
export const BooleanField = () =>
  applyDecorators(
    Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
      const raw = obj?.[key];
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return raw;
    }),
    IsBoolean(),
  );
