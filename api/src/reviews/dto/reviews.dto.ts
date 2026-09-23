import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { TrimmedString } from '../../common/dto/decorators.js';

export class CreateReviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  productId!: string;

  @IsInt({ message: 'Pick 1 to 5 stars' })
  @Min(1, { message: 'Pick 1 to 5 stars' })
  @Max(5, { message: 'Pick 1 to 5 stars' })
  rating!: number;

  @TrimmedString(3, 1500)
  body!: string;
}
