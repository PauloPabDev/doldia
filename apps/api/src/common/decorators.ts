import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AppRequest, AuthUser } from './request';

export const IS_PUBLIC = 'isPublic';
/** Marca una ruta como pública: por defecto todas requieren sesión. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface RateLimitOptions {
  name: string;
  limit: number;
  windowMs: number;
  /** Claves para agrupar: ip, usuario o un campo del body (por ejemplo el correo). */
  by: Array<'ip' | 'user' | `body.${string}`>;
}
export const RATE_LIMIT = 'rateLimit';
export const RateLimit = (opts: RateLimitOptions) => SetMetadata(RATE_LIMIT, opts);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.user) throw new Error('CurrentUser usado en una ruta pública');
  return req.user;
});
