import { createValidationPipe } from '../common/validation.js';
import { AppException } from '../common/errors.js';
import { ProductInputDto } from '../admin/dto/product.dto.js';
import { SettingsInputDto } from '../admin/dto/settings.dto.js';
import { CounterDto, CreateCustomDto, QuoteInputDto } from './dto/custom.dto.js';

const pipe = createValidationPipe();
const parse = <T>(metatype: new () => T, value: unknown) => pipe.transform(value, { type: 'body', metatype }) as Promise<T>;
const fieldsOf = async (p: Promise<unknown>) => {
  const err = (await p.catch((e: unknown) => e)) as AppException;
  expect(err).toBeInstanceOf(AppException);
  expect(err.getStatus()).toBe(400);
  return err.fields ?? {};
};

const validCreate = {
  kind: 'NEW', category: 'plushies', title: 'Graduation bear', description: 'A small crochet bear in a graduation cap, cream and navy.',
  colours: ['Cream', 'Navy'], size: '15 cm', quantity: 1, budgetMin: 1500, budgetMax: 2200, neededBy: '', occasion: '', personalization: '',
  references: [], country: 'IN', postalCode: '560038', phone: '98765 43210',
};

describe('CreateCustomDto', () => {
  it('accepts the web form payload and normalises phone + blanks', async () => {
    const dto = await parse(CreateCustomDto, validCreate);
    expect(dto.phone).toBe('+919876543210');
    expect(dto.neededBy).toBeUndefined();
    expect(dto.occasion).toBeUndefined();
  });

  it('rejects short descriptions, bad counts, bad images and unknown fields', async () => {
    const fields = await fieldsOf(parse(CreateCustomDto, { ...validCreate, description: 'too short', quantity: 0, references: ['javascript:alert(1)'], userId: 'someone-else' }));
    expect(Object.keys(fields).sort()).toEqual(['description', 'quantity', 'references', 'userId']);
  });

  it('limits references to five', async () => {
    const fields = await fieldsOf(parse(CreateCustomDto, { ...validCreate, references: Array.from({ length: 6 }, (_, i) => `/uploads/${i}.jpg`) }));
    expect(fields).toHaveProperty('references');
  });
});

describe('QuoteInputDto / CounterDto', () => {
  it('validates the breakdown lines strictly', async () => {
    const ok = await parse(QuoteInputDto, { breakdown: [{ label: 'Materials', amount: 500 }], timelineDays: 8, revisions: 1, scope: 'One piece as described.' });
    expect(ok.breakdown[0].amount).toBe(500);
    const fields = await fieldsOf(parse(QuoteInputDto, { breakdown: [{ label: '', amount: -5.5 }], timelineDays: 0, revisions: 11, scope: '' }));
    expect(Object.keys(fields)).toEqual(expect.arrayContaining(['breakdown.0.label', 'breakdown.0.amount', 'timelineDays', 'revisions', 'scope']));
  });

  it('a counter must be a whole positive number of rupees', async () => {
    await parse(CounterDto, { amount: 1500, note: 'Could we do 7 stems?' });
    expect(await fieldsOf(parse(CounterDto, { amount: 0 }))).toHaveProperty('amount');
    expect(await fieldsOf(parse(CounterDto, { amount: 10.5 }))).toHaveProperty('amount');
    expect(await fieldsOf(parse(CounterDto, { amount: '1500' }))).toHaveProperty('amount');
  });
});

describe('admin DTOs', () => {
  it('product input tolerates echoed read-only fields but rejects unknown ones', async () => {
    const base = {
      name: 'Rosie', tagline: '', description: '', category: 'plushies', price: 100, fulfilment: 'READY', leadTimeDays: 1, fiber: '', sizeCm: '', weightG: 0,
      care: [], images: [], swatches: [], variants: [], isOneOfAKind: false, customizable: true, giftable: true, occasions: [], tags: [], status: 'DRAFT',
    };
    await parse(ProductInputDto, { ...base, id: 'p1', batch: 3, createdAt: '2026-01-01', rating: { average: 5, count: 1 }, sample: true });
    expect(await fieldsOf(parse(ProductInputDto, { ...base, role: 'admin' }))).toEqual({ role: 'Not allowed' });
    expect(await fieldsOf(parse(ProductInputDto, { ...base, price: 0, fulfilment: 'SOON', slug: 'Bad Slug' }))).toEqual(expect.objectContaining({ price: expect.any(String), fulfilment: expect.any(String), slug: expect.any(String) }));
  });

  it('settings input validates nested zones', async () => {
    const good = {
      whatsapp: '919876543210', email: 'hello@fuzz.example', freeShippingAbove: 999, domesticShipping: 79, codEnabled: true, codCap: 2000, codFee: 49,
      giftWrapPrice: 59, depositPct: 50, quoteValidityDays: 7, intlZones: [{ name: 'UK', countries: ['GB'], rate: 1499, days: '8-14 days' }],
    };
    await parse(SettingsInputDto, good);
    const fields = await fieldsOf(parse(SettingsInputDto, { ...good, depositPct: 0, intlZones: [{ name: '', countries: ['gb'], rate: -1, days: '' }] }));
    expect(Object.keys(fields)).toEqual(expect.arrayContaining(['depositPct', 'intlZones.0.name', 'intlZones.0.countries', 'intlZones.0.rate']));
  });
});
