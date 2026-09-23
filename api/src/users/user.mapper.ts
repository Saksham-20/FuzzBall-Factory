import type { Role } from '../generated/prisma/enums.js';

/** Wire shape of `User` (web/src/lib/types.ts). Never includes credentials or tokenVersion. */
export interface UserDto {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  createdAt: string;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  createdAt: Date;
}

export const toUserDto = (u: UserRow): UserDto => ({
  id: u.id,
  name: u.name,
  email: u.email,
  ...(u.phone ? { phone: u.phone } : {}),
  role: u.role,
  createdAt: u.createdAt.toISOString(),
});
