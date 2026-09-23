import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import type { Prisma } from '../../src/generated/prisma/client.js';
import { NotificationsService } from '../../src/notifications/notifications.service.js';
import { RAZORPAY_GATEWAY, type RazorpayGateway } from '../../src/payments/razorpay.gateway.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import type { TestApp } from './e2e.js';

export interface CommerceApp extends TestApp {
  /** Put process.env back the way it was (call in afterAll). */
  restoreEnv: () => void;
}

/**
 * Boots the real app for the commerce e2e files: mail recorder, rate limits off, and per-file environment.
 * `env` entries are set BEFORE the app reads its config (undefined/'' = unset), so a test file can pin
 * "no Razorpay keys" (mock payments) or "keys present" (live) whatever is in the developer's .env.
 * `config` pins validated settings such as NODE_ENV (Nest's ConfigService validated the env once at import, so
 * changing process.env later does not affect keys that were already set; `env` is enough for optional keys).
 * `gateway` replaces the Razorpay SDK wrapper with a fake so no test ever calls the network.
 */
export async function bootCommerce(opts: { env?: Record<string, string | undefined>; config?: Record<string, unknown>; gateway?: RazorpayGateway } = {}): Promise<CommerceApp> {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(opts.env ?? {})) {
    previous[k] = process.env[k];
    process.env[k] = v ?? '';
  }
  ThrottlerGuard.prototype.canActivate = () => Promise.resolve(true);

  const sent: TestApp['sent'] = [];
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(NotificationsService)
    .useValue({
      send: (event: string, payload: Record<string, unknown>) => {
        sent.push({ event, payload });
        return Promise.resolve();
      },
    });
  if (opts.gateway) builder = builder.overrideProvider(RAZORPAY_GATEWAY).useValue(opts.gateway);
  const moduleRef = await builder.compile();
  const app: INestApplication = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  if (opts.config) {
    const cfg = app.get(ConfigService);
    const original = cfg.get.bind(cfg) as (key: string, ...rest: unknown[]) => unknown;
    (cfg as unknown as { get: typeof original }).get = (key, ...rest) => (key in opts.config! ? opts.config![key] : original(key, ...rest));
  }
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    sent,
    restoreEnv: () => {
      for (const [k, v] of Object.entries(previous)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    },
  };
}

/** Env that guarantees the mock payment flow regardless of the developer's .env. */
export const MOCK_PAYMENT_ENV = { RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_SECRET: undefined, RAZORPAY_WEBHOOK_SECRET: undefined };

let seq = 0;
export interface Fixture {
  productId: string;
  variantId: string;
  slug: string;
  price: number;
}

/** A throw-away published product (slug `e2e-<tag>-...`) so tests never depend on or disturb the seeded stock. */
export async function makeProduct(
  prisma: PrismaService,
  tag: string,
  o: { price?: number; stock?: number; fulfilment?: 'READY' | 'MADE_TO_ORDER'; leadTimeDays?: number; isOneOfAKind?: boolean; status?: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'; categorySlug?: string; extra?: Record<string, unknown> } = {},
): Promise<Fixture> {
  const category = o.categorySlug ? await prisma.category.findUniqueOrThrow({ where: { slug: o.categorySlug } }) : await prisma.category.findFirstOrThrow({ orderBy: { sortOrder: 'asc' } });
  const slug = `e2e-${tag}-${Date.now()}-${++seq}`;
  const p = await prisma.product.create({
    data: {
      slug,
      name: `E2E ${slug}`,
      categoryId: category.id,
      price: o.price ?? 400,
      fulfilment: o.fulfilment ?? 'READY',
      leadTimeDays: o.leadTimeDays ?? 2,
      isOneOfAKind: o.isOneOfAKind ?? false,
      status: o.status ?? 'PUBLISHED',
      sample: true,
      swatches: [{ name: 'Cream', hex: '#f1e4d3' }] as Prisma.InputJsonValue,
      images: { create: [{ url: '/samples/bear.jpg', alt: 'Bear', sortOrder: 0 }] },
      variants: { create: [{ sku: slug, colour: 'Cream', priceDelta: 0, stock: o.stock ?? 5 }] },
      ...(o.extra as object),
    },
    include: { variants: true },
  });
  return { productId: p.id, variantId: p.variants[0].id, slug, price: p.price };
}

export const stockOf = async (prisma: PrismaService, variantId: string) => (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;

/** Body for POST /orders. Every order a test places uses an `@e2e.test` email so cleanup can find it. */
export function orderBody(tag: string, lines: { productId: string; variantId: string; qty?: number; personalization?: string }[], o: Record<string, unknown> = {}) {
  return {
    lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty ?? 1, ...(l.personalization ? { personalization: l.personalization } : {}) })),
    contact: { name: 'E2E Shopper', email: `${tag}@e2e.test`, phone: '9811122233' },
    address: { name: 'E2E Shopper', phone: '9811122233', line1: '12 Test Street', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'IN' },
    paymentMethod: 'RAZORPAY',
    ...o,
  };
}

/** Removes everything a commerce test created: orders (by e2e email), payments, products, coupons, users, keys. */
export async function cleanupCommerce(prisma: PrismaService, opts: { tags: string[]; couponCodes?: string[]; userIds?: string[] }) {
  const orders = await prisma.order.findMany({ where: { OR: opts.tags.map((t) => ({ contactEmail: { startsWith: t } })) }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  await prisma.payment.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.couponRedemption.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.review.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.product.deleteMany({ where: { OR: opts.tags.map((t) => ({ slug: { startsWith: `e2e-${t}` } })) } });
  if (opts.couponCodes?.length) await prisma.coupon.deleteMany({ where: { code: { in: opts.couponCodes } } });
  if (opts.userIds?.length) await prisma.user.deleteMany({ where: { id: { in: opts.userIds } } });
  await prisma.idempotencyKey.deleteMany({ where: { OR: opts.tags.map((t) => ({ key: { startsWith: `e2e-${t}` } })) } });
  await prisma.webhookEvent.deleteMany({ where: { OR: opts.tags.map((t) => ({ eventId: { startsWith: `e2e-${t}` } })) } });
}

export const guest = (t: { app: INestApplication }) => request.agent(t.app.getHttpServer());
