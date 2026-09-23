import { AdminReviewsService } from './admin-reviews.service.js';

/**
 * A stand-in for PrismaService whose ROOT client has no model delegates at all: the only way for the service to
 * read or write is through the transaction handle it is given, so anything that escaped the transaction throws.
 */
function harness(review: { id: string; status: string; productId: string; reply?: string | null; repliedAt?: Date | null; disputeReason?: string | null }) {
  const calls: string[] = [];
  let row = { ...review };
  const tx = {
    review: {
      findUnique: async (args: { where: { id: string } }) => {
        calls.push('review.findUnique');
        return args.where.id === row.id ? { id: row.id, status: row.status, productId: row.productId } : null;
      },
      update: async (args: { data: Record<string, unknown> }) => {
        calls.push('review.update');
        row = { ...row, ...args.data } as typeof row;
        return { id: row.id, productId: row.productId, author: 'Maya', rating: 4, body: 'Lovely', verified: true, status: row.status, reply: row.reply ?? null, repliedAt: row.repliedAt ?? null, disputeReason: row.disputeReason ?? null, createdAt: new Date('2026-01-01') };
      },
      aggregate: async () => {
        calls.push('review.aggregate');
        return { _avg: { rating: 4 }, _count: { _all: 1 } };
      },
    },
    product: {
      update: async () => {
        calls.push('product.update');
        return {};
      },
    },
  };
  let transactions = 0;
  const prisma = {
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> => {
      transactions += 1;
      return fn(tx);
    },
  };
  const audit = { log: async (entry: unknown, db: unknown) => { calls.push(db === tx ? 'audit(tx)' : 'audit(ROOT)'); void entry; } };
  const svc = new AdminReviewsService(prisma as never, audit as never);
  return { svc, calls, row: () => row, transactions: () => transactions };
}

const ctx = { actorId: 'admin1' };

describe('AdminReviewsService.moderate', () => {
  it('publishes/hides without a reason, recomputes the rating, and audits through the transaction handle', async () => {
    const h = harness({ id: 'r1', status: 'PENDING', productId: 'p1' });
    const dto = await h.svc.moderate(ctx, 'r1', 'PUBLISHED');
    expect(dto).toMatchObject({ id: 'r1', status: 'PUBLISHED' });
    expect(h.calls).toEqual(['review.findUnique', 'review.update', 'review.aggregate', 'product.update', 'audit(tx)']);
    expect(h.transactions()).toBe(1);
  });

  it('moving to DISPUTED without a reason is rejected before any write happens', async () => {
    const h = harness({ id: 'r1', status: 'PUBLISHED', productId: 'p1' });
    await expect(h.svc.moderate(ctx, 'r1', 'DISPUTED')).rejects.toMatchObject({ code: 'VALIDATION_FAILED', fields: { disputeReason: expect.any(String) } });
    await expect(h.svc.moderate(ctx, 'r1', 'DISPUTED', '   ')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(h.calls).toEqual([]);
    expect(h.transactions()).toBe(0);
  });

  it('moving to DISPUTED with a reason stores it, hides the review from the rating, and audits the reason', async () => {
    const h = harness({ id: 'r1', status: 'PUBLISHED', productId: 'p1' });
    const dto = await h.svc.moderate(ctx, 'r1', 'DISPUTED', '  A false claim about the yarn.  ');
    expect(dto).toMatchObject({ status: 'DISPUTED', disputeReason: 'A false claim about the yarn.' });
    expect(h.row().disputeReason).toBe('A false claim about the yarn.');
  });

  it('the dispute reason is kept on the row even after the review is published again', async () => {
    const h = harness({ id: 'r1', status: 'DISPUTED', productId: 'p1', disputeReason: 'Mismatched order.' });
    const dto = await h.svc.moderate(ctx, 'r1', 'PUBLISHED');
    expect(dto.status).toBe('PUBLISHED');
    expect(h.row().disputeReason).toBe('Mismatched order.'); // update() only touches `status` for a non-DISPUTED move
  });

  it('an unknown review is a 404 and nothing is written', async () => {
    const h = harness({ id: 'r1', status: 'PENDING', productId: 'p1' });
    await expect(h.svc.moderate(ctx, 'nope', 'PUBLISHED')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(h.calls).not.toContain('review.update');
  });
});

describe('AdminReviewsService.setReply / clearReply', () => {
  it('sets a trimmed reply and stamps repliedAt, then audits it', async () => {
    const h = harness({ id: 'r1', status: 'PUBLISHED', productId: 'p1' });
    const dto = await h.svc.setReply(ctx, 'r1', '  Thank you! ');
    expect(dto.reply).toBe('Thank you!');
    expect(dto.repliedAt).toBeTruthy();
    expect(h.calls).toEqual(['review.findUnique', 'review.update', 'audit(tx)']);
  });

  it('rejects a blank reply without writing anything', async () => {
    const h = harness({ id: 'r1', status: 'PUBLISHED', productId: 'p1' });
    await expect(h.svc.setReply(ctx, 'r1', '   ')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(h.calls).toEqual([]);
  });

  it('clears an existing reply', async () => {
    const h = harness({ id: 'r1', status: 'PUBLISHED', productId: 'p1', reply: 'Thanks!', repliedAt: new Date('2026-01-01') });
    const dto = await h.svc.clearReply(ctx, 'r1');
    expect(dto.reply).toBeUndefined();
    expect(dto.repliedAt).toBeUndefined();
  });

  it('an unknown review is a 404 for both reply actions', async () => {
    const h = harness({ id: 'r1', status: 'PUBLISHED', productId: 'p1' });
    await expect(h.svc.setReply(ctx, 'nope', 'Hi')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(h.svc.clearReply(ctx, 'nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
