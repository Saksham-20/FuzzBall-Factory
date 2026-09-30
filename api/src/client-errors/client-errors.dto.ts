import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TrimmedString } from '../common/dto/decorators.js';

export class ClientErrorDto {
  @TrimmedString(1, 300)
  message!: string;

  /** Next.js's server-side error id, when the failure came from the server render. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  digest?: string;

  /** Path only, never a query string. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  path?: string;

  @IsIn(['render', 'global'])
  kind!: 'render' | 'global';
}
