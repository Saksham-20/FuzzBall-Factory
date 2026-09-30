import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { NormalizedEmail, PhoneField, TrimmedString } from '../../common/dto/decorators.js';
import { normalizePhone } from '../../common/phone.js';
import { CountryField } from '../../pricing/dto/country.js';

/** `PATCH /account/profile`. Send only what changes; `phone: ""` (or null) removes the phone number. */
export class UpdateProfileDto {
  @IsOptional()
  @TrimmedString(1, 80)
  name?: string;

  /** Not changeable here: use `POST /account/email-change`. Accepted only when it equals the current address. */
  @IsOptional()
  @NormalizedEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === '' || value === null) return null;
    return typeof value === 'string' ? (normalizePhone(value) ?? value.trim()) : value;
  })
  @Matches(/^\+\d{8,15}$/, { message: 'Enter a valid phone number' })
  phone?: string | null;

  /** Required to change or remove the phone number. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword?: string;
}

/** `POST /account/email-change`: the new address gets a confirm link; nothing changes until it is clicked. */
export class ChangeEmailDto {
  @NormalizedEmail()
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Required' })
  @MaxLength(128)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Required' })
  @MaxLength(128)
  current!: string;

  @IsString()
  @MinLength(8, { message: 'Use at least 8 characters' })
  @MaxLength(128, { message: 'Use at most 128 characters' })
  next!: string;
}

/** Web `Omit<Address, "id">` (the id is in the URL for updates). */
export class SaveAddressDto {
  @TrimmedString(1, 40)
  label!: string;

  @TrimmedString(2, 80)
  name!: string;

  @PhoneField()
  phone!: string;

  @TrimmedString(3, 200)
  line1!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  line2?: string;

  @TrimmedString(2, 80)
  city!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  state!: string;

  @TrimmedString(1, 12)
  postalCode!: string;

  @CountryField()
  country!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
