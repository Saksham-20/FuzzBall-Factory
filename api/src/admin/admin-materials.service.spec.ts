import { AdminMaterialsService, toMaterialDto } from './admin-materials.service.js';
import type { MaterialInputDto } from './dto/material.dto.js';

const input = (over: Partial<MaterialInputDto> = {}): MaterialInputDto =>
  ({
    name: 'Cotton yarn, cream, 100g skein',
    unit: 'skein',
    costPerUnit: 180,
    qtyOnHand: 12,
    lowStockAt: 3,
    notes: undefined,
    ...over,
  }) as MaterialInputDto;

describe('toMaterialDto', () => {
  const row = { id: 'm1', name: 'Cotton yarn', unit: 'skein', costPerUnit: 180, qtyOnHand: 4.5, lowStockAt: null, notes: null, archived: false, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02') };

  it('omits null lowStockAt and notes rather than sending null', () => {
    const dto = toMaterialDto(row as never);
    expect(dto).not.toHaveProperty('lowStockAt');
    expect(dto).not.toHaveProperty('notes');
    expect(dto.qtyOnHand).toBe(4.5);
  });

  it('includes lowStockAt and notes when set', () => {
    const dto = toMaterialDto({ ...row, lowStockAt: 3, notes: 'From the usual supplier' } as never);
    expect(dto.lowStockAt).toBe(3);
    expect(dto.notes).toBe('From the usual supplier');
  });
});

/**
 * A stand-in for PrismaService whose ROOT client has no model delegates: the only way for the service to
 * read or write is through the transaction handle it is given, so anything that escaped the transaction throws.
 */
function harness(existing?: { id: string; name: string; qtyOnHand: number }) {
  const calls: string[] = [];
  const row = (over: Partial<{ id: string; name: string; unit: string; costPerUnit: number; qtyOnHand: number; lowStockAt: number | null; notes: string | null; archived: boolean }> = {}) => ({
    id: 'm1', name: 'Cotton yarn, cream, 100g skein', unit: 'skein', costPerUnit: 180, qtyOnHand: 12, lowStockAt: 3, notes: null, archived: false,
    createdAt: new Date(), updatedAt: new Date(), ...over,
  });
  const tx = {
    material: {
      findMany: async () => {
        calls.push('material.findMany');
        return [row()];
      },
      findUnique: async (args: { where: { id: string } }) => {
        calls.push('material.findUnique');
        if (!existing || args.where.id !== existing.id) return null;
        return row({ id: existing.id, name: existing.name, qtyOnHand: existing.qtyOnHand });
      },
      create: async (args: { data: Record<string, unknown> }) => {
        calls.push('material.create');
        return row(args.data as never);
      },
      update: async (args: { data: Record<string, unknown> }) => {
        calls.push('material.update');
        return row({ id: existing?.id ?? 'm1', name: existing?.name ?? 'Cotton yarn', ...(args.data as never) });
      },
    },
    auditLog: { create: async () => { calls.push('auditLog.create'); } },
  };
  let transactions = 0;
  const prisma = {
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> => {
      transactions += 1;
      return fn(tx);
    },
  };
  const audit = { log: async (entry: unknown, db: unknown) => { calls.push(db === tx ? 'audit(tx)' : 'audit(ROOT)'); void entry; } };
  const svc = new AdminMaterialsService(prisma as never, audit as never);
  return { svc, calls, transactions: () => transactions };
}

describe('AdminMaterialsService', () => {
  const ctx = { actorId: 'admin1' };

  it('create writes the material and audits through the same transaction handle', async () => {
    const h = harness();
    const dto = await h.svc.create(ctx, input());
    expect(h.transactions()).toBe(1);
    expect(h.calls).toEqual(['material.create', 'audit(tx)']);
    expect(dto.name).toBe('Cotton yarn, cream, 100g skein');
  });

  it('update on an unknown id is a 404 and writes nothing', async () => {
    const h = harness();
    await expect(h.svc.update(ctx, 'nope', input())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(h.calls).not.toContain('material.update');
  });

  it('update on a known id writes and audits', async () => {
    const h = harness({ id: 'm1', name: 'Cotton yarn', qtyOnHand: 12 });
    const dto = await h.svc.update(ctx, 'm1', input({ costPerUnit: 200 }));
    expect(dto.costPerUnit).toBe(200);
    expect(h.calls.at(-1)).toBe('audit(tx)');
  });

  it('archive is a soft delete: sets archived true, never deletes the row', async () => {
    const h = harness({ id: 'm1', name: 'Cotton yarn', qtyOnHand: 12 });
    await h.svc.archive(ctx, 'm1');
    expect(h.calls).toContain('material.update');
    expect(h.calls.at(-1)).toBe('audit(tx)');
  });

  it('archiving an unknown id is a 404', async () => {
    const h = harness();
    await expect(h.svc.archive(ctx, 'nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('adjustStock adds delta to qtyOnHand (negative delta records usage) and rounds off float drift', async () => {
    const h = harness({ id: 'm1', name: 'Cotton yarn', qtyOnHand: 4.5 });
    const dto = await h.svc.adjustStock(ctx, 'm1', { delta: -1.1 });
    expect(dto.qtyOnHand).toBeCloseTo(3.4, 5);
  });

  it('adjustStock allows a delta that leaves qty at or below zero (miscounts happen)', async () => {
    const h = harness({ id: 'm1', name: 'Poly-fil stuffing', qtyOnHand: 1 });
    const dto = await h.svc.adjustStock(ctx, 'm1', { delta: -3 });
    expect(dto.qtyOnHand).toBe(-2);
  });

  it('adjustStock on an unknown id is a 404', async () => {
    const h = harness();
    await expect(h.svc.adjustStock(ctx, 'nope', { delta: -1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
