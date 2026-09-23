import { timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PASSWORD_HASH_OPTIONS, sha256Hex } from './password-hash.js';

export { PASSWORD_HASH_OPTIONS, sha256Hex };

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
}

@Injectable()
export class HashingService {
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return argon2.hash(password, PASSWORD_HASH_OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** True when the stored digest uses weaker parameters than today's and should be re-hashed on next login. */
  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, PASSWORD_HASH_OPTIONS);
  }

  /**
   * Verify against a throwaway hash so "unknown user" costs the same time as "wrong password"
   * (no account enumeration through response timing).
   */
  async burn(password: string): Promise<void> {
    this.dummyHash ??= this.hash('fuzzball-timing-equaliser');
    await this.verify(await this.dummyHash, password);
  }
}
