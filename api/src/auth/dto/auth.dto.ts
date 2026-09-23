import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizedEmail, PhoneField, TrimmedString } from '../../common/dto/decorators.js';

export class SignupDto {
  @TrimmedString(1, 80)
  name!: string;

  @NormalizedEmail()
  email!: string;

  @IsOptional()
  @PhoneField()
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'Use at least 8 characters' })
  @MaxLength(128, { message: 'Use at most 128 characters' })
  password!: string;
}

export class LoginDto {
  /** Email or phone number. */
  @TrimmedString(1, 254)
  identifier!: string;

  @IsString()
  @MinLength(1, { message: 'Required' })
  @MaxLength(128)
  password!: string;
}

export class ForgotPasswordDto {
  @NormalizedEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Use at least 8 characters' })
  @MaxLength(128, { message: 'Use at most 128 characters' })
  password!: string;
}
