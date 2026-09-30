import type { Role } from '../generated/prisma/enums.js';

/** Wire shape of `User` (web/src/lib/types.ts). Never includes credentials or tokenVersion. */
export interface UserDto {
  id: string;
  name: string;
  email: string;
  phone?: string;
  /** The inbox has been proven (signup link, password reset, or a confirmed email change). */
  emailVerified: boolean;
  /** Set while an account-deletion request is waiting out its 30 days; the customer can withdraw it. */
  deletionRequestedAt?: string;
  role: Role;
  createdAt: string;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  deletionRequestedAt?: Date | null;
  role: Role;
  createdAt: Date;
}

export const toUserDto = (u: UserRow): UserDto => ({
  id: u.id,
  name: u.name,
  email: u.email,
  ...(u.phone ? { phone: u.phone } : {}),
  emailVerified: u.emailVerified,
  ...(u.deletionRequestedAt ? { deletionRequestedAt: u.deletionRequestedAt.toISOString() } : {}),
  role: u.role,
  createdAt: u.createdAt.toISOString(),
});
