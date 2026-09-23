import type { CookieOptions, Response } from 'express';

export const ACCESS_COOKIE = 'fbf_at';
export const REFRESH_COOKIE = 'fbf_rt';
/** The refresh cookie is only ever sent to /auth/*, keeping the long-lived token off every other request. */
export const REFRESH_COOKIE_PATH = '/auth';

export interface CookieConfig {
  secure: boolean;
  domain?: string;
  accessTtlMs: number;
  refreshTtlMs: number;
}

const base = (cfg: CookieConfig): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: cfg.secure,
  ...(cfg.domain ? { domain: cfg.domain } : {}),
});

export function setAuthCookies(res: Response, tokens: { access: string; refresh: string }, cfg: CookieConfig) {
  res.cookie(ACCESS_COOKIE, tokens.access, { ...base(cfg), path: '/', maxAge: cfg.accessTtlMs });
  res.cookie(REFRESH_COOKIE, tokens.refresh, { ...base(cfg), path: REFRESH_COOKIE_PATH, maxAge: cfg.refreshTtlMs });
}

export function clearAuthCookies(res: Response, cfg: Pick<CookieConfig, 'secure' | 'domain'>) {
  const opts = base({ ...cfg, accessTtlMs: 0, refreshTtlMs: 0 });
  res.clearCookie(ACCESS_COOKIE, { ...opts, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...opts, path: REFRESH_COOKIE_PATH });
}
