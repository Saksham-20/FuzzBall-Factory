import { Matches, MaxLength } from 'class-validator';
import { TrimmedString } from '../../common/dto/decorators.js';
import { IMAGE_REF } from '../../custom/dto/custom.dto.js';
import { SLUG } from './product.dto.js';

export class CategoryInputDto {
  /** Immutable key. On PUT it must match the URL (or be omitted). */
  @Matches(SLUG, { message: 'Use lowercase letters, numbers and dashes' })
  @MaxLength(60)
  slug!: string;

  @TrimmedString(1, 60)
  name!: string;

  /** The giant cropped word on the home page. */
  @TrimmedString(1, 24)
  word!: string;

  @TrimmedString(0, 200)
  blurb!: string;

  @Matches(IMAGE_REF, { message: 'Use an uploaded image URL' })
  @MaxLength(500)
  image!: string;
}
