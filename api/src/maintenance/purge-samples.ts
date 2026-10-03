import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Removes the sample rows the old seed created (`npm run purge-samples`), from databases that already have them.
 * Nothing real is touched: a sample customer who ever placed an order or a work order is kept and reported, and
 * a coupon someone really redeemed is kept too. Past orders keep their item snapshots when a product goes
 * (`OrderItem.productId` is SET NULL).
 */
export const SAMPLE_USER_EMAILS = ['maya@example.com', 'arjun@example.com', 'sophie@example.com'] as const;
export const SAMPLE_COUPON_CODES = ['FIRSTFUZZ', 'GIFT100', 'EXPIRED20'] as const;
/** Where the old seed pointed shelf covers; the maker's own photo replaces them. */
const OLD_COVER_PREFIX = '/samples/';
const NEW_COVER = '/maker/crew-hedgehog.jpg';
const COVER_BY_SLUG: Record<string, string> = { plushies: '/maker/crew-turtle.jpg', keychains: '/maker/whale-pod.jpg' };

export interface PurgeReport {
  applied: boolean;
  products: string[];
  users: string[];
  /** Sample customers kept because real activity hangs off them: email and why. */
  keptUsers: { email: string; reason: string }[];
  coupons: string[];
  keptCoupons: { code: string; reason: string }[];
  /** Shelves whose cover photo moved off /samples/. */
  covers: string[];
}

export async function purgeSamples(prisma: PrismaClient, opts: { apply: boolean }): Promise<PurgeReport> {
  const report: PurgeReport = { applied: opts.apply, products: [], users: [], keptUsers: [], coupons: [], keptCoupons: [], covers: [] };

  const products = await prisma.product.findMany({ where: { sample: true }, select: { id: true, slug: true } });
  report.products = products.map((p) => p.slug);

  const users = await prisma.user.findMany({
    where: { email: { in: [...SAMPLE_USER_EMAILS] }, role: 'customer' },
    select: { id: true, email: true, _count: { select: { orders: true, customRequests: true } } },
  });
  const doomedUsers: { id: string; email: string }[] = [];
  for (const u of users) {
    if (u._count.orders > 0 || u._count.customRequests > 0) {
      report.keptUsers.push({ email: u.email, reason: `${u._count.orders} order(s), ${u._count.customRequests} work order(s)` });
    } else {
      doomedUsers.push(u);
      report.users.push(u.email);
    }
  }

  const coupons = await prisma.coupon.findMany({
    where: { code: { in: [...SAMPLE_COUPON_CODES] } },
    select: { id: true, code: true, redemptions: { select: { userId: true, orderId: true } } },
  });
  const doomedIds = new Set(doomedUsers.map((u) => u.id));
  const doomedCoupons: { id: string; code: string }[] = [];
  for (const c of coupons) {
    // A redemption tied to an order is real money; one from a sample user without an order is seed noise.
    const real = c.redemptions.filter((r) => r.orderId !== null || (r.userId !== null && !doomedIds.has(r.userId)));
    if (real.length > 0) report.keptCoupons.push({ code: c.code, reason: `${real.length} real redemption(s)` });
    else {
      doomedCoupons.push(c);
      report.coupons.push(c.code);
    }
  }

  const covers = await prisma.category.findMany({ where: { image: { startsWith: OLD_COVER_PREFIX } }, select: { id: true, slug: true } });
  report.covers = covers.map((c) => c.slug);

  if (!opts.apply) return report;

  await prisma.$transaction(async (tx) => {
    if (products.length) await tx.product.deleteMany({ where: { id: { in: products.map((p) => p.id) } } });
    if (doomedUsers.length) await tx.user.deleteMany({ where: { id: { in: doomedUsers.map((u) => u.id) } } });
    if (doomedCoupons.length) await tx.coupon.deleteMany({ where: { id: { in: doomedCoupons.map((c) => c.id) } } });
    for (const c of covers) await tx.category.update({ where: { id: c.id }, data: { image: COVER_BY_SLUG[c.slug] ?? NEW_COVER } });
    await tx.auditLog.create({
      data: {
        action: 'maintenance.purge-samples',
        entity: 'System',
        meta: { products: report.products.length, users: report.users, coupons: report.coupons, covers: report.covers, keptUsers: report.keptUsers.map((k) => k.email) },
      },
    });
  });
  return report;
}
