import { ArrayMaxSize, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

export class MergeWishlistDto {
  /** Pieces saved on this device while signed out. Unknown or unpublished ids are skipped, not errors. */
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(64, { each: true })
  productIds!: string[];
}
