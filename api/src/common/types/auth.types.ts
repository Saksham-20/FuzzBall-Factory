import type { Request } from 'express';
import type { Role } from '../../generated/prisma/enums.js';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  /** User.tokenVersion at issue time. */
  tv: number;
}

export interface RefreshTokenPayload {
  sub: string;
  /** Token family (one login session). */
  fam: string;
  /** RefreshToken.id */
  jti: string;
  tv: number;
}

/** Attached to `request.user` by JwtAuthGuard. Role is read from the DB, not the token. */
export interface RequestUser {
  userId: string;
  role: Role;
}

export type AuthedRequest = Request & { user?: RequestUser };
