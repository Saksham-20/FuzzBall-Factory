import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import type { Paginated } from '../common/dto/pagination.dto.js';
import { CatalogService } from './catalog.service.js';
import { ByIdsQueryDto, ProductQueryDto, RelatedQueryDto } from './dto/product-query.dto.js';
import type { CategoryDto, ProductDto } from './product.mapper.js';

@Public()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories(): Promise<CategoryDto[]> {
    return this.catalog.listCategories();
  }

  @Get('products')
  products(@Query() query: ProductQueryDto): Promise<Paginated<ProductDto>> {
    return this.catalog.listProducts(query);
  }

  // Declared before `products/:slug` so "by-ids" is never read as a slug.
  @Get('products/by-ids')
  byIds(@Query() query: ByIdsQueryDto): Promise<ProductDto[]> {
    return this.catalog.byIds(query.ids);
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string): Promise<ProductDto> {
    return this.catalog.getProduct(slug);
  }

  @Get('products/:slug/related')
  related(@Param('slug') slug: string, @Query() query: RelatedQueryDto): Promise<ProductDto[]> {
    return this.catalog.related(slug, query.limit);
  }
}
