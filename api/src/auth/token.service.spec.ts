import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { REUSE_GRACE_MS, TokenService, type RefreshRow } from './token.service.js';
import { sha256Hex } from '../common/hashing.service.js';

/** In-memory stand-in for the two Prisma delegates TokenService touches. */
function fakePrisma() {
  const tokens = new Map<string, RefreshRow>();
  const users = new Map<string, { id: string; role: 'customer' | 'admin'; tokenVersion: number }>();
  const prisma = {
    refreshToken: {
      create: async ({ data }: { data: Omit<RefreshRow, 'revokedAt' | 'replacedById'> }) => {
        tokens.set(data.id, { ...data, revokedAt: null, replacedById: null });
      },
      findUnique: async ({ where }: { where: { id: string } }) => tokens.get(where.id) ?? null,
      updateMany: async ({ where, data }: { where: { id?: string; familyId?: string; userId?: string; revokedAt: null }; data: Partial<RefreshRow> }) => {
        let count = 0;
        for (const t of tokens.values()) {
          const match = (where.id === undefined || t.id === where.id) && (where.familyId === undefined || t.familyId === where.familyId) && (where.userId === undefined || t.userId === where.userId) && t.revokedAt === null;
          if (match) {
            Object.assign(t, data);
            count++;
          }
        }
        return { count };
      },
    },
    user: { findUnique: async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null },
  };
  return { prisma, tokens, users };
}

const CONFIG: Record<string, unknown> = { JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), ACCESS_TTL_MINUTES: 15, REFRESH_TTL_DAYS: 30 };

function setup() {
  const { prisma, tokens, users } = fakePrisma();
  const jwt = new JwtService();
  const service = new TokenService(jwt, { get: (k: string) => CONFIG[k] } as never, prisma as never);
  const user = { id: 'u1', role: 'customer' as const, tokenVersion: 0 };
  users.set(user.id, user);
  return { service, tokens, users, user, jwt };
}

describe('TokenService refresh rotation', () => {
  it('startSession stores only a hash of the refresh token, and access token carries sub/role/tv', async () => {
    const { service, tokens, user, jwt } = setup();
    const { access, refresh } = await service.startSession(user);
    const [row] = [...tokens.values()];
    expect(row.tokenHash).toBe(sha256Hex(refresh));
    expect(JSON.stringify([...tokens.values()])).not.toContain(refresh);
    const payload = await jwt.verifyAsync(access, { secret: CONFIG.JWT_ACCESS_SECRET as string });
    expect(payload).toMatchObject({ sub: 'u1', role: 'customer', tv: 0 });
  });

  it('rotates: old token revoked and linked to its successor in the same family', async () => {
    const { service, tokens, user } = setup();
    const first = await service.startSession(user);
    const second = await service.rotate(first.refresh);
    expect(second.userId).toBe('u1');
    expect(second.refresh).not.toBe(first.refresh);
    const rows = [...tokens.values()];
    expect(rows).toHaveLength(2);
    const [old, next] = rows;
    expect(old.revokedAt).not.toBeNull();
    expect(old.replacedById).toBe(next.id);
    expect(next.revokedAt).toBeNull();
    expect(next.familyId).toBe(old.familyId);
    // the new token keeps working
    await expect(service.rotate(second.refresh)).resolves.toMatchObject({ userId: 'u1' });
  });

  it('reuse of a rotated token (outside the grace window) revokes the whole family', async () => {
    const { service, tokens, user } = setup();
    const first = await service.startSession(user);
    const second = await service.rotate(first.refresh);
    // age the revocation beyond the race window
    const old = [...tokens.values()][0];
    old.revokedAt = new Date(Date.now() - REUSE_GRACE_MS - 1000);

    await expect(service.rotate(first.refresh)).rejects.toMatchObject({ response: { code: 'TOKEN_REUSED' } });
    expect([...tokens.values()].every((t) => t.revokedAt !== null)).toBe(true);
    // the thief AND the victim's newest token are now dead
    await expect(service.rotate(second.refresh)).rejects.toMatchObject({ response: { code: expect.stringMatching(/TOKEN_REUSED|SESSION_EXPIRED/) } });
  });

  it('a just-rotated token presented again (two tabs racing) is refused but the family survives', async () => {
    const { service, tokens, user } = setup();
    const first = await service.startSession(user);
    const second = await service.rotate(first.refresh);
    await expect(service.rotate(first.refresh)).rejects.toMatchObject({ response: { code: 'SESSION_EXPIRED' } });
    const live = [...tokens.values()].filter((t) => t.revokedAt === null);
    expect(live).toHaveLength(1);
    await expect(service.rotate(second.refresh)).resolves.toBeDefined();
  });

  it('tokenVersion bump revokes the family and rejects the refresh', async () => {
    const { service, tokens, users, user } = setup();
    const { refresh } = await service.startSession(user);
    users.get('u1')!.tokenVersion = 1;
    await expect(service.rotate(refresh)).rejects.toMatchObject({ response: { code: 'SESSION_EXPIRED' } });
    expect([...tokens.values()].every((t) => t.revokedAt !== null)).toBe(true);
  });

  it('rejects garbage, foreign-signed, expired and unknown-row tokens', async () => {
    const { service, tokens, user, jwt } = setup();
    await expect(service.rotate('garbage')).rejects.toMatchObject({ response: { code: 'SESSION_EXPIRED' } });

    const foreign = await jwt.signAsync({ sub: 'u1', fam: 'f', jti: randomUUID(), tv: 0 }, { secret: 'z'.repeat(32) });
    await expect(service.rotate(foreign)).rejects.toMatchObject({ response: { code: 'SESSION_EXPIRED' } });

    const orphan = await jwt.signAsync({ sub: 'u1', fam: 'f', jti: randomUUID(), tv: 0 }, { secret: CONFIG.JWT_REFRESH_SECRET as string });
    await expect(service.rotate(orphan)).rejects.toMatchObject({ response: { code: 'SESSION_EXPIRED' } });

    const { refresh } = await service.startSession(user);
    [...tokens.values()].at(-1)!.expiresAt = new Date(Date.now() - 1);
    await expect(service.rotate(refresh)).rejects.toMatchObject({ response: { code: 'SESSION_EXPIRED' } });
  });

  it('a validly-signed token whose stored hash differs is rejected', async () => {
    const { service, tokens, user } = setup();
    const { refresh } = await service.startSession(user);
    [...tokens.values()][0].tokenHash = sha256Hex('something else');
    await expect(service.rotate(refresh)).rejects.toMatchObject({ response: { code: 'SESSION_EXPIRED' } });
  });

  it('logout (revokeByToken) kills the family, and ignores garbage', async () => {
    const { service, tokens, user } = setup();
    const first = await service.startSession(user);
    const second = await service.rotate(first.refresh);
    await service.revokeByToken(second.refresh);
    expect([...tokens.values()].every((t) => t.revokedAt !== null)).toBe(true);
    await expect(service.revokeByToken('garbage')).resolves.toBeUndefined();
    await expect(service.revokeByToken(undefined)).resolves.toBeUndefined();
  });
});
