/**
 * Stand-in for `lib/mock/db` in real-API builds (`NEXT_PUBLIC_USE_MOCK=false`): next.config.ts aliases the module to this
 * file so the seeded users, passwords, orders and work orders never reach the browser bundle. Same runtime exports as the
 * real module (ApiError, wait, db); every call site is behind an `if (!SITE.useMock)` early return, so `db` is never used.
 */
export { ApiError } from "@/lib/api/errors";

const unavailable = (): never => {
  throw new Error("The sample database is not part of a real-API build (NEXT_PUBLIC_USE_MOCK=false).");
};

export const db = { get: unavailable, update: unavailable, reset: unavailable };

export const wait = (): Promise<void> => Promise.resolve();
