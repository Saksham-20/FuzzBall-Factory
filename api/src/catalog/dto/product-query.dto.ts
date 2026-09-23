import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TrimmedString } from '../../common/dto/decorators.js';

export const SORTS = ['newest', 'price-asc', 'price-desc', 'ready-first'] as const;
export type ProductSort = (typeof SORTS)[number];

/** `GET /products` query: the same parameters as web `catalog.listProducts` (`ProductQuery`). */
export class ProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @TrimmedString(1, 100)
  q?: string;

  @IsOptional()
  @IsIn(SORTS)
  sort?: ProductSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max?: number;

  @IsOptional()
  @IsIn(['ready', 'mto'])
  availability?: 'ready' | 'mto';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  colour?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  occasion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 12;
}

export class RelatedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  limit: number = 4;
}

export class ByIdsQueryDto {
  /** Comma-separated product ids (max 50). */
  @IsString()
  @MaxLength(50 * 40)
  ids!: string;
}
