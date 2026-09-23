import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { SettingsService } from '../settings/settings.service.js';
import { quoteCheckout, validateCoupon, couponDiscount } from './pricing.engine.js';
import type { CheckoutOptions, CheckoutQuote, PricingCoupon, PricingLine, PricingProduct } from './pricing.types.js';

type Db = PrismaService | Prisma.TransactionClient;

export interface CouponCheck {
  valid: boolean;
  code?: string;
  kind?: 'PERCENT' | 'FLAT';
  value?: number;
  /** Rupees off the current subtotal. */
  discount?: number;
  error?: string;
}

/** Loads catalogue, settings and coupon rows and runs the pure engine. Used by `/checkout/quote` and by order placement. */
@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** Published products (with their variants) for the given lines, shaped for the engine. */
  async loadPricingProducts(db: Db, lines: PricingLine[]): Promise<PricingProduct[]> {
    const ids = [...new Set(lines.map((l) => l.productId))];
    if (ids.length === 0) return [];
    const rows = await db.product.findMany({
      where: { id: { in: ids }, status: 'PUBLISHED' },
      select: { id: true, price: true, fulfilment: true, leadTimeDays: true, variants: { select: { id: true, priceDelta: true } } },
    });
    return rows;
  }

  /** The coupon row for `code` (case-insensitive) as the engine expects it, with the user's redemption count. */
  async loadCoupons(db: Db, code: string | undefined, userId: string | undefined): Promise<PricingCoupon[]> {
    const trimmed = code?.trim();
    if (!trimmed) return [];
    const row = await db.coupon.findFirst({ where: { code: { equals: trimmed, mode: 'insensitive' } } });
    if (!row) return [];
    const usedByUser = userId && row.perUserLimit != null ? await db.couponRedemption.count({ where: { couponId: row.id, userId } }) : 0;
    return [{ code: row.code, kind: row.kind, value: row.value, minCart: row.minCart, active: row.active, expiresAt: row.expiresAt, uses: row.uses, maxUses: row.maxUses, perUserLimit: row.perUserLimit, usedByUser }];
  }

  async quote(lines: PricingLine[], opts: CheckoutOptions, userId?: string, db: Db = this.prisma): Promise<CheckoutQuote> {
    const [settings, products, coupons] = await Promise.all([this.settings.getStoreSettings(db), this.loadPricingProducts(db, lines), this.loadCoupons(db, opts.coupon, userId)]);
    return quoteCheckout(lines, opts, settings, products, coupons);
  }

  /** `POST /coupons/validate`: validates against the server-priced subtotal of `lines`. */
  async checkCoupon(code: string, lines: PricingLine[], userId?: string): Promise<CouponCheck> {
    const [products, coupons] = await Promise.all([this.loadPricingProducts(this.prisma, lines), this.loadCoupons(this.prisma, code, userId)]);
    const subtotal = lines.reduce((s, l) => {
      const p = products.find((x) => x.id === l.productId);
      const v = p?.variants.find((x) => x.id === l.variantId);
      return p && v ? s + (p.price + v.priceDelta) * l.qty : s;
    }, 0);
    const r = validateCoupon(code, subtotal, coupons);
    if (!r.coupon) return { valid: false, error: r.error };
    return { valid: true, code: r.coupon.code, kind: r.coupon.kind, value: r.coupon.value, discount: couponDiscount(r.coupon, subtotal) };
  }
}
