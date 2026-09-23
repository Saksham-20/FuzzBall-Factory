import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const blank = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value));

const CUSTOM_STATUSES = [
  'REQUESTED', 'UNDER_REVIEW', 'QUOTED', 'COUNTERED', 'ACCEPTED', 'DEPOSIT_PENDING', 'IN_QUEUE', 'IN_PROGRESS', 'AWAITING_APPROVAL',
  'BALANCE_PENDING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CLOSED', 'DECLINED', 'EXPIRED', 'CANCELLED',
] as const;
export const ORDER_STATUSES = [
  'PENDING_PAYMENT', 'PLACED', 'CONFIRMED', 'IN_PRODUCTION', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'REFUNDED',
] as const;

export class ProductListQuery {
  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @blank()
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

/** `TO_CONFIRM` (COD awaiting WhatsApp), `TO_MAKE`, `TO_PACK` are the admin tabs; anything else is an exact status. */
export class OrderListQuery {
  @blank()
  @IsOptional()
  @IsIn([...ORDER_STATUSES, 'TO_CONFIRM', 'TO_MAKE', 'TO_PACK'])
  status?: (typeof ORDER_STATUSES)[number] | 'TO_CONFIRM' | 'TO_MAKE' | 'TO_PACK';

  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class CustomListQuery {
  @blank()
  @IsOptional()
  @IsIn(CUSTOM_STATUSES)
  status?: (typeof CUSTOM_STATUSES)[number];
}

export class CustomerListQuery {
  @blank()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ReviewListQuery {
  @blank()
  @IsOptional()
  @IsIn(['PENDING', 'PUBLISHED', 'HIDDEN', 'DISPUTED'])
  status?: 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'DISPUTED';
}
