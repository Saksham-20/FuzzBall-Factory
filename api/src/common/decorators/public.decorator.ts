import { applyDecorators, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const OPTIONAL_AUTH_KEY = 'optionalAuth';

/** Opt a route out of the global JwtAuthGuard (signup, login, catalogue reads, health…). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Guest-friendly route: anyone may call it, but if a valid access token/cookie is present
 * `request.user` is populated (cart, checkout, order read/track). An invalid token is treated as a guest.
 */
export const OptionalAuth = () => applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), SetMetadata(OPTIONAL_AUTH_KEY, true));
