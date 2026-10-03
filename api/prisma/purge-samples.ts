/**
 * `npm run purge-samples` prints what would go. `npm run purge-samples -- --yes` deletes it.
 * Sample products, the three sample customers, the three sample coupons; shelf covers move off /samples/.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { purgeSamples } from '../src/maintenance/purge-samples.js';

try {
  process.loadEnvFile('.env');
} catch {
  // rely on the real environment
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const apply = process.argv.includes('--yes');

const list = (label: string, items: string[]) => console.log(`${label} (${items.length}): ${items.join(', ') || 'none'}`);

purgeSamples(prisma, { apply })
  .then((r) => {
    console.log(apply ? 'APPLIED' : 'DRY RUN (nothing deleted; add --yes to delete)');
    list('products', r.products);
    list('customers', r.users);
    list('coupons', r.coupons);
    list('shelf covers moved', r.covers);
    for (const k of r.keptUsers) console.log(`kept customer ${k.email}: ${k.reason}`);
    for (const k of r.keptCoupons) console.log(`kept coupon ${k.code}: ${k.reason}`);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
