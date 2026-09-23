import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppException, badRequest, ErrorCode, notFound, validationFailed } from '../common/errors.js';
import { NumberingService } from '../common/numbering.service.js';
import type { RequestUser } from '../common/types/auth.types.js';
import { PAYMENTS_PORT, type CheckoutPayment, type PaymentsPort } from '../payments/payments.types.js';
import { quoteCheckout } from '../pricing/pricing.engine.js';
import { PricingService } from '../pricing/pricing.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { addressFieldErrors } from '../shipping/address-validation.js';
import type { PlaceOrderDto } from './dto/orders.dto.js';
import { OrderNotifier } from './order-notifier.service.js';
import { OrderStateService, SYSTEM_ACTOR, type OrderActor } from './order-state.service.js';
import { CUSTOMER_CANCELLABLE, PAYMENT_WINDOW_MINUTES, RETURN_WINDOW_DAYS } from './order-transitions.js';
import { ORDER_INCLUDE, toOrderDto, type OrderDto, type OrderRow } from './order.mapper.js';

/** `POST /orders` response: the order (web `Order`) plus, for online payments, what the checkout needs to pay. */
export type PlacedOrderDto = OrderDto & { payment?: CheckoutPayment };

/** Who is asking, for the ownership rules. `guestNumbers` = order numbers in the browser's `fbf_go` cookie. */
export interface OrderViewer {
  user?: RequestUser;
  guestNumbers: string[];
}

const NOT_FOUND = "We couldn't find that order.";
const digits = (s: string) => s.replace(/\D/g, '');
const SWEEP_EVERY_MS = 10 * 60_000;

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private sweeper?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly numbering: NumberingService,
    private readonly pricing: PricingService,
    private readonly settings: SettingsService,
    private readonly state: OrderStateService,
    private readonly notifier: OrderNotifier,
    @Inject(PAYMENTS_PORT) private readonly payments: PaymentsPort,
  ) {}

  onModuleInit() {
    // Release stock held by unpaid online orders. unref(): never keeps the process (or a test run) alive.
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    this.sweeper = setInterval(() => void this.expireUnpaidOrders().catch((e: Error) => this.logger.error(`Sweep failed: ${e.message}`)), SWEEP_EVERY_MS);
    this.sweeper.unref();
  }

  onModuleDestroy() {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  // ───────────── place ─────────────

  async place(dto: PlaceOrderDto, user?: RequestUser): Promise<PlacedOrderDto> {
    if (dto.lines.length === 0) throw badRequest('Your basket is empty.', { lines: 'Add something first' });
    this.validateAddress(dto.address);

    const created = await this.prisma.$transaction((tx) => this.createOrder(tx, dto, user), { timeout: 15_000 });

    if (dto.paymentMethod === 'COD') {
      void this.notifier.placed(created);
      return toOrderDto(created);
    }

    let payment: CheckoutPayment;
    try {
      payment = await this.payments.createPayment({ purpose: 'ORDER', amount: created.total, orderId: created.id, userId: user?.userId, receipt: created.number });
    } catch (err) {
      // Couldn't start the payment: don't leave the pieces reserved for an order nobody can pay.
      await this.state.transition(created.number, 'CANCELLED', SYSTEM_ACTOR, { note: "We couldn't start the payment.", silent: true }).catch((e: Error) => this.logger.error(`Cleanup of ${created.number} failed: ${e.message}`));
      throw err;
    }
    return { ...toOrderDto(created), payment };
  }

  private validateAddress(a: PlaceOrderDto['address']) {
    const fields = addressFieldErrors(a, 'address.');
    if (Object.keys(fields).length) throw validationFailed(fields);
  }

  private async createOrder(tx: Prisma.TransactionClient, dto: PlaceOrderDto, user?: RequestUser): Promise<OrderRow> {
    const productIds = [...new Set(dto.lines.map((l) => l.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, status: 'PUBLISHED' },
      include: { variants: true, images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    });

    // Resolve every line to a real, published product + variant (never trust client-supplied names or prices).
    const resolved = dto.lines.map((l) => {
      const product = products.find((p) => p.id === l.productId);
      const variant = product?.variants.find((v) => v.id === l.variantId);
      if (!product || !variant) throw notFound('One of the pieces in your basket is no longer available.');
      return { line: l, product, variant };
    });

    const settings = await this.settings.getStoreSettings(tx);
    const coupons = await this.pricing.loadCoupons(tx, dto.coupon, user?.userId);
    const quote = quoteCheckout(
      dto.lines,
      { country: dto.address.country, giftWrap: dto.giftWrap, coupon: dto.coupon, paymentMethod: dto.paymentMethod },
      settings,
      products.map((p) => ({ id: p.id, price: p.price, fulfilment: p.fulfilment, leadTimeDays: p.leadTimeDays, variants: p.variants.map((v) => ({ id: v.id, priceDelta: v.priceDelta })) })),
      coupons,
    );

    if (dto.paymentMethod === 'COD' && !quote.codEligible) throw badRequest(quote.codReason ?? "Cash on delivery isn't available for this order.", undefined, 'COD_NOT_AVAILABLE');
    if (dto.coupon && !quote.couponApplied) throw badRequest(quote.couponError ?? "That code can't be used.", { coupon: quote.couponError ?? 'Not valid' }, 'COUPON_INVALID');
    if (dto.paymentMethod === 'RAZORPAY' && quote.total < 1) throw badRequest("This order doesn't need an online payment. Please contact us.");

    // Stock: one conditional decrement per variant (rows are locked in a fixed order to avoid deadlocks).
    // `updateMany ... WHERE stock >= qty` is the race guard: two shoppers can't both take the last piece.
    const wanted = new Map<string, { qty: number; name: string }>();
    for (const r of resolved) wanted.set(r.variant.id, { qty: (wanted.get(r.variant.id)?.qty ?? 0) + r.line.qty, name: r.product.name });
    for (const [variantId, { qty, name }] of [...wanted].sort(([a], [b]) => a.localeCompare(b))) {
      const res = await tx.productVariant.updateMany({ where: { id: variantId, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
      if (res.count !== 1) throw new AppException(409, 'OUT_OF_STOCK', `${name} just sold out or has fewer left than you asked for.`);
    }

    const coupon = quote.couponApplied ? await tx.coupon.findUnique({ where: { code: quote.couponApplied } }) : null;
    if (coupon) {
      const bumped = await tx.coupon.updateMany({ where: { id: coupon.id, ...(coupon.maxUses != null ? { uses: { lt: coupon.maxUses } } : {}) }, data: { uses: { increment: 1 } } });
      if (bumped.count !== 1) throw badRequest('This code has been fully redeemed.', { coupon: 'Fully redeemed' }, 'COUPON_INVALID');
    }

    const cod = dto.paymentMethod === 'COD';
    const number = await this.numbering.nextOrderNumber(tx);
    const giftWrap = !!dto.giftWrap;
    const order = await tx.order.create({
      data: {
        number,
        userId: user?.userId,
        contact: { name: dto.contact.name, email: dto.contact.email, phone: dto.contact.phone },
        contactEmail: dto.contact.email,
        contactPhone: dto.contact.phone,
        address: {
          name: dto.address.name,
          phone: dto.address.phone,
          line1: dto.address.line1,
          ...(dto.address.line2 ? { line2: dto.address.line2 } : {}),
          city: dto.address.city,
          state: dto.address.state,
          postalCode: dto.address.postalCode,
          country: dto.address.country,
        },
        subtotal: quote.subtotal,
        shipping: quote.shipping,
        codFee: quote.codFee,
        giftWrap: quote.giftWrap,
        discount: quote.discount,
        total: quote.total,
        paymentMethod: dto.paymentMethod,
        paymentStatus: cod ? 'COD_DUE' : 'PENDING',
        status: cod ? 'PLACED' : 'PENDING_PAYMENT',
        giftNote: giftWrap && dto.giftNote ? dto.giftNote : null,
        hidePrices: giftWrap ? !!dto.hidePrices : false,
        couponCode: quote.couponApplied ?? null,
        estimatedDispatch: new Date(quote.estimatedDispatch),
        items: {
          create: resolved.map(({ line, product, variant }) => ({
            productId: product.id,
            variantId: variant.id,
            name: product.name,
            image: product.images[0]?.url ?? '',
            colour: variant.colour,
            size: variant.size,
            qty: line.qty,
            unitPrice: product.price + variant.priceDelta,
            fulfilment: product.fulfilment,
            personalization: line.personalization ?? null,
          })),
        },
        events: { create: { status: cod ? 'PLACED' : 'PENDING_PAYMENT', note: cod ? "Order placed. We'll confirm on WhatsApp before dispatch." : null, actorId: user?.userId ?? null } },
      },
      include: ORDER_INCLUDE,
    });

    if (coupon) await tx.couponRedemption.create({ data: { couponId: coupon.id, orderId: order.id, userId: user?.userId, amount: quote.discount } });

    if (dto.saveAddress && user) {
      const hasAny = (await tx.address.count({ where: { userId: user.userId } })) > 0;
      await tx.address.create({
        data: { userId: user.userId, label: 'Saved at checkout', name: dto.address.name, phone: dto.address.phone, line1: dto.address.line1, line2: dto.address.line2 || null, city: dto.address.city, state: dto.address.state, postalCode: dto.address.postalCode, country: dto.address.country, isDefault: !hasAny },
      });
    }
    return order;
  }

  // ───────────── read ─────────────

  async listMine(userId: string): Promise<OrderDto[]> {
    const rows = await this.prisma.order.findMany({ where: { userId }, include: ORDER_INCLUDE, orderBy: { createdAt: 'desc' } });
    return rows.map(toOrderDto);
  }

  /**
   * Ownership rules (docs/API.md rule 10): an admin reads anything; a signed-in customer reads their own orders;
   * a guest order is readable only by the browser that placed it (`fbf_go` cookie). Anything else is a 404,
   * never a 403, so order numbers can't be probed.
   */
  async findAccessible(number: string, viewer: OrderViewer): Promise<OrderRow> {
    const n = number.trim().toUpperCase();
    const o = await this.prisma.order.findUnique({ where: { number: n }, include: ORDER_INCLUDE });
    if (!o) throw notFound(NOT_FOUND);
    if (viewer.user?.role === 'admin') return o;
    if (o.userId) {
      if (viewer.user?.userId === o.userId) return o;
      throw notFound(NOT_FOUND);
    }
    if (viewer.guestNumbers.includes(o.number)) return o;
    throw notFound(NOT_FOUND);
  }

  async get(number: string, viewer: OrderViewer): Promise<OrderDto> {
    return toOrderDto(await this.findAccessible(number, viewer));
  }

  /** Public tracking: number + phone or email. A wrong pair and an unknown number are indistinguishable. */
  async track(number: string, contact: string): Promise<OrderDto> {
    const miss = () => notFound("We couldn't find that order. Check the number on your confirmation and the phone or email you used.");
    const o = await this.prisma.order.findUnique({ where: { number: number.trim().toUpperCase() }, include: ORDER_INCLUDE });
    const c = contact.trim().toLowerCase();
    if (!o) throw miss();
    const emailMatch = c.includes('@') && o.contactEmail.toLowerCase() === c;
    // Phones match on the last 10 digits (so +91 / 0 prefixes don't matter); fewer than 10 digits never match.
    const d = digits(c);
    const phoneMatch = !c.includes('@') && d.length >= 10 && digits(o.contactPhone).endsWith(d.slice(-10));
    if (!emailMatch && !phoneMatch) throw miss();
    return toOrderDto(o);
  }

  // ───────────── customer actions ─────────────

  private actorFor(viewer: OrderViewer): OrderActor {
    return { userId: viewer.user?.userId ?? null, role: viewer.user?.role ?? 'customer' };
  }

  async cancel(number: string, reason: string | undefined, viewer: OrderViewer): Promise<OrderDto> {
    const o = await this.findAccessible(number, viewer);
    if (!CUSTOMER_CANCELLABLE.includes(o.status)) {
      throw new AppException(409, ErrorCode.INVALID_TRANSITION, "This order can't be cancelled any more. Message us on WhatsApp and we'll help.");
    }
    return this.state.transition(o.number, 'CANCELLED', this.actorFor(viewer), { note: reason ?? 'Cancelled at your request.' });
  }

  async requestReturn(number: string, reason: string, viewer: OrderViewer): Promise<OrderDto> {
    const o = await this.findAccessible(number, viewer);
    if (o.status !== 'DELIVERED') throw badRequest('Returns open once an order is delivered.');
    if (o.items.some((i) => i.fulfilment === 'MADE_TO_ORDER' || i.personalization)) {
      throw badRequest("Made-to-order and personalised pieces can't be returned unless damaged. Message us on WhatsApp.");
    }
    const deliveredAt = o.events.findLast((e) => e.status === 'DELIVERED')?.at ?? o.updatedAt;
    if (Date.now() - deliveredAt.getTime() > RETURN_WINDOW_DAYS * 86_400_000) {
      throw badRequest(`The ${RETURN_WINDOW_DAYS}-day return window has closed. Message us on WhatsApp and we'll see what we can do.`);
    }
    return this.state.transition(o.number, 'RETURN_REQUESTED', this.actorFor(viewer), { note: reason });
  }

  /** Retry paying for an unpaid online order (e.g. after a failed or abandoned attempt): a fresh Razorpay order for the same total. */
  async startPayment(number: string, viewer: OrderViewer): Promise<CheckoutPayment> {
    const o = await this.findAccessible(number, viewer);
    if (o.status !== 'PENDING_PAYMENT' || o.paymentMethod !== 'RAZORPAY') {
      throw new AppException(409, ErrorCode.CONFLICT, "This order doesn't need a payment.");
    }
    const payment = await this.payments.createPayment({ purpose: 'ORDER', amount: o.total, orderId: o.id, userId: o.userId ?? undefined, receipt: o.number });
    await this.prisma.order.updateMany({ where: { id: o.id, status: 'PENDING_PAYMENT', paymentStatus: 'FAILED' }, data: { paymentStatus: 'PENDING' } });
    return payment;
  }

  // ───────────── housekeeping ─────────────

  /** Cancels online orders that were never paid within the payment window, returning their stock. */
  async expireUnpaidOrders(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - PAYMENT_WINDOW_MINUTES * 60_000);
    const stale = await this.prisma.order.findMany({
      where: { status: 'PENDING_PAYMENT', paymentMethod: 'RAZORPAY', createdAt: { lt: cutoff }, payments: { none: { status: 'PAID' } } },
      select: { number: true },
      take: 100,
    });
    let cancelled = 0;
    for (const { number } of stale) {
      try {
        await this.state.transition(number, 'CANCELLED', SYSTEM_ACTOR, { note: 'The payment window expired, so the pieces were released.' });
        cancelled += 1;
      } catch (err) {
        this.logger.warn(`Could not expire ${number}: ${(err as Error).message}`);
      }
    }
    return cancelled;
  }
}
