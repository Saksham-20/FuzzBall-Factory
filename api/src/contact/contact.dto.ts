import { IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizedEmail, TrimmedString } from '../common/dto/decorators.js';

export class ContactDto {
  @TrimmedString(2, 80)
  name!: string;

  @NormalizedEmail()
  email!: string;

  @TrimmedString(10, 1500)
  message!: string;

  /** Honeypot: hidden in the form, so only a bot fills it. A message that has it is dropped without a sound. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
