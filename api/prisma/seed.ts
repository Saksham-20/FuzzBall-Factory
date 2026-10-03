/**
 * Idempotent seed: `npm run seed` (also runs after `prisma migrate reset`).
 *
 *  - admin user from ADMIN_EMAIL / ADMIN_PASSWORD (password is only set on first creation)
 *  - default store settings, counters, shelves (categories)   (never overwrite values an admin has changed)
 *
 * No products, customers or coupons are seeded: the maker lists real ones through the admin. Databases that
 * still hold the old sample rows are cleaned with `npm run purge-samples`.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/password-hash.js';
import { categories } from './seed-data/categories.js';

try {
  process.loadEnvFile('.env');
} catch {
  // rely on the real environment
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });


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

async function seedCategories() {
  for (const [i, c] of categories.entries()) {
    // `update: {}`: once the maker edits a shelf in the admin, re-seeding must not put the stock copy back.
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { slug: c.slug, name: c.name, word: c.word, blurb: c.blurb, image: c.image, sortOrder: i },
    });
  }
  console.log(`categories: ${categories.length} shelves ready (no products are seeded)`);
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

async function main() {
  await seedAdmin();
  await seedSettings();
  await seedCategories();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
