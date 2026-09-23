/**
 * Idempotent seed: `npm run seed` (also runs after `prisma migrate reset`).
 *
 *  - admin user from ADMIN_EMAIL / ADMIN_PASSWORD (password is only set on first creation)
 *  - default store settings, counters, coupons     (never overwrite values an admin has changed)
 *  - SAMPLE data (sample users, categories, 15 sample products): skipped when NODE_ENV=production
 *    unless SEED_SAMPLES=true. Sample products carry sample=true so the UI can flag them.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/password-hash.js';
import { categories, products } from './seed-data/catalog.js';

try {
  process.loadEnvFile('.env');
} catch {
  // rely on the real environment
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const SAMPLE_PASSWORD = 'fuzzball123';
const withSamples = process.env.NODE_ENV !== 'production' || process.env.SEED_SAMPLES === 'true';
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000);

/** Mirrors web/src/lib/mock/db.ts. Keys mirror StoreSettings. */
const SETTINGS: Record<string, Prisma.InputJsonValue> = {
  whatsapp: process.env.WHATSAPP_NUMBER || '910000000000',
  email: 'hello@fuzzballfactory.example',
  freeShippingAbove: 999,
  domesticShipping: 79,
  codEnabled: true,
  codCap: 2000,
  codFee: 49,
  giftWrapPrice: 59,
  depositPct: 50,
  quoteValidityDays: 7,
  intlZones: [
    { name: 'South Asia & Middle East', countries: ['NP', 'LK', 'BD', 'AE', 'SA', 'QA'], rate: 899, days: '7–12 days' },
    { name: 'UK & Europe', countries: ['GB', 'DE', 'FR', 'NL', 'IT', 'ES', 'IE'], rate: 1499, days: '8–14 days' },
    { name: 'USA, Canada & Australia', countries: ['US', 'CA', 'AU', 'NZ', 'SG', 'MY'], rate: 1799, days: '10–16 days' },
    { name: 'Rest of world', countries: ['*', 'OTHER'], rate: 1999, days: '12–20 days' },
  ],
};

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@fuzzball.test').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'fuzzball123';
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) throw new Error('Set ADMIN_PASSWORD to seed the admin in production');
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: 'admin' } });
    console.log(`admin: ${email} (exists, role ensured, password untouched)`);
    return;
  }
  await prisma.user.create({
    data: { name: 'Factory Admin', email, phone: '+910000000000', passwordHash: await hashPassword(password), role: 'admin', emailVerified: true },
  });
  console.log(`admin: ${email} created`);
}

async function seedSampleUsers() {
  const sample = [
    { name: 'Maya Iyer', email: 'maya@example.com', phone: '+919800000001' },
    { name: 'Arjun Nair', email: 'arjun@example.com', phone: '+919800000002' },
    { name: 'Sophie Clarke', email: 'sophie@example.com', phone: '+447700900123' },
  ];
  const passwordHash = await hashPassword(SAMPLE_PASSWORD);
  for (const u of sample) {
    await prisma.user.upsert({ where: { email: u.email }, update: { name: u.name }, create: { ...u, passwordHash, role: 'customer' } });
  }
  const maya = await prisma.user.findUniqueOrThrow({ where: { email: 'maya@example.com' } });
  const addresses = [
    { id: 'seed-addr-maya-home', label: 'Home', name: 'Maya Iyer', phone: '+919800000001', line1: '12, Lotus Apartments, 4th Cross', line2: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'IN', isDefault: true },
    { id: 'seed-addr-maya-london', label: 'Sister in London', name: 'Anu Iyer', phone: '+447700900456', line1: '5 Rosebery Road', city: 'London', state: 'England', postalCode: 'N10 2LE', country: 'GB', isDefault: false },
  ];
  for (const a of addresses) await prisma.address.upsert({ where: { id: a.id }, update: {}, create: { ...a, userId: maya.id } });
  console.log(`sample users: ${sample.length} (password "${SAMPLE_PASSWORD}")`);
}

async function seedCatalogue() {
  const categoryIds = new Map<string, string>();
  for (const [i, c] of categories.entries()) {
    const data = { name: c.name, word: c.word, blurb: c.blurb, image: c.image, sortOrder: i };
    const row = await prisma.category.upsert({ where: { slug: c.slug }, update: data, create: { slug: c.slug, ...data } });
    categoryIds.set(c.slug, row.id);
  }

  for (const p of products) {
    const data = {
      name: p.name,
      tagline: p.tagline,
      description: p.description,
      categoryId: categoryIds.get(p.category)!,
      price: p.price,
      compareAtPrice: p.compareAtPrice ?? null,
      fulfilment: p.fulfilment,
      leadTimeDays: p.leadTimeDays,
      fiber: p.fiber,
      sizeCm: p.sizeCm,
      weightG: p.weightG,
      care: p.care,
      swatches: p.swatches as unknown as Prisma.InputJsonValue,
      isOneOfAKind: p.isOneOfAKind,
      customizable: p.customizable,
      giftable: p.giftable,
      occasions: p.occasions,
      tags: p.tags,
      status: p.status,
      sample: true,
    };
    const row = await prisma.product.upsert({
      where: { slug: p.slug },
      update: data,
      create: { slug: p.slug, batch: p.batch, createdAt: new Date(p.createdAt), ...data },
    });
    // Sample images are canonical: rewrite them so the list always matches the seed file.
    await prisma.productImage.deleteMany({ where: { productId: row.id } });
    await prisma.productImage.createMany({ data: p.images.map((img, i) => ({ productId: row.id, url: img.src, alt: img.alt, sortOrder: i })) });
    // Variants: keyed by sku. Stock is only set on creation so re-seeding never resets live stock.
    for (const v of p.variants) {
      await prisma.productVariant.upsert({
        where: { sku: v.id },
        update: { colour: v.colour, size: v.size ?? null, priceDelta: v.priceDelta },
        create: { sku: v.id, productId: row.id, colour: v.colour, size: v.size ?? null, priceDelta: v.priceDelta, stock: v.stock },
      });
    }
  }
  // Explicit `batch` values don't advance the autoincrement sequence: move it past the largest batch.
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Product"', 'batch'), (SELECT COALESCE(MAX("batch"), 1) FROM "Product"))`;
  console.log(`catalogue: ${categories.length} categories, ${products.length} sample products`);
}

async function seedSettings() {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  // Counters hold the LAST issued number: first order is FB-1001, first work order WO-001.
  await prisma.counter.upsert({ where: { key: 'order' }, update: {}, create: { key: 'order', value: 1000 } });
  await prisma.counter.upsert({ where: { key: 'work_order' }, update: {}, create: { key: 'work_order', value: 0 } });
  console.log(`settings: ${Object.keys(SETTINGS).length} keys, counters ready`);
}

async function seedCoupons() {
  const coupons = [
    { code: 'FIRSTFUZZ', kind: 'PERCENT', value: 10, minCart: 0, active: true, uses: 12 },
    { code: 'GIFT100', kind: 'FLAT', value: 100, minCart: 999, active: true, uses: 4 },
    { code: 'EXPIRED20', kind: 'PERCENT', value: 20, minCart: 0, active: false, uses: 30, expiresAt: daysFromNow(-20) },
  ] as const;
  for (const c of coupons) {
    await prisma.coupon.upsert({ where: { code: c.code }, update: {}, create: { ...c } });
  }
  console.log(`coupons: ${coupons.length}`);
}

async function main() {
  await seedAdmin();
  await seedSettings();
  if (withSamples) {
    await seedSampleUsers();
    await seedCatalogue();
    await seedCoupons();
  } else {
    console.log('NODE_ENV=production: sample users, catalogue and coupons skipped (set SEED_SAMPLES=true to force).');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
