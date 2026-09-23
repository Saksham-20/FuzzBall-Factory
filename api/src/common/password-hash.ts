import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';

/**
 * Framework-free hashing primitives (also imported by prisma/seed.ts, which runs outside Nest).
 * argon2id, OWASP reference configuration (19 MiB, t=2, p=1). Verification reads the parameters from the
 * stored digest, so these can be raised later: `HashingService.needsRehash` upgrades hashes on next login.
 */
export const PASSWORD_HASH_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = (password: string): Promise<string> => argon2.hash(password, PASSWORD_HASH_OPTIONS);

/** SHA-256 hex. For high-entropy secrets only (refresh/reset tokens), never for passwords. */
export const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');
