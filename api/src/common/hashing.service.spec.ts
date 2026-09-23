import { HashingService, safeEqualHex, sha256Hex } from './hashing.service.js';

describe('HashingService', () => {
  const hashing = new HashingService();

  it('hashes with argon2id and verifies the right password only', async () => {
    const hash = await hashing.hash('correct horse battery');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await hashing.verify(hash, 'correct horse battery')).toBe(true);
    expect(await hashing.verify(hash, 'wrong')).toBe(false);
  });

  it('salts: the same password never hashes to the same digest', async () => {
    expect(await hashing.hash('same')).not.toBe(await hashing.hash('same'));
  });

  it('verify returns false (not throws) for a malformed digest', async () => {
    expect(await hashing.verify('not-a-hash', 'x')).toBe(false);
  });

  it('flags weaker legacy parameters for re-hash, but not current ones', async () => {
    const current = await hashing.hash('pw');
    expect(hashing.needsRehash(current)).toBe(false);
    const argon2 = await import('argon2');
    const weak = await argon2.hash('pw', { type: argon2.argon2id, memoryCost: 4096, timeCost: 1, parallelism: 1 });
    expect(hashing.needsRehash(weak)).toBe(true);
  });

  it('sha256Hex is stable and safeEqualHex compares in constant-time form', () => {
    const a = sha256Hex('token');
    expect(a).toHaveLength(64);
    expect(a).toBe(sha256Hex('token'));
    expect(safeEqualHex(a, sha256Hex('token'))).toBe(true);
    expect(safeEqualHex(a, sha256Hex('other'))).toBe(false);
    expect(safeEqualHex(a, 'abcd')).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
  });
});
