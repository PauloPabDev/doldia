import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { loadEnv } from '../config';
import { verifyJwt } from '../modules/auth/jwt';
import { parseCookies } from './cookies';
import { IS_PUBLIC, RATE_LIMIT, RateLimitOptions } from './decorators';
import { AppError, unauthorized } from './errors';
import { RateLimiter } from './rate-limiter';
import type { AppRequest } from './request';

export const ACCESS_COOKIE = 'access';

/** Guard global: verifica el JWT de la cookie solo con node:crypto, sin consultar la BD. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    req.cookies = parseCookies(req.headers.cookie);

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const token = req.cookies[ACCESS_COOKIE];

    if (token) {
      const env = loadEnv();
      try {
        const payload = verifyJwt(token, {
          secrets: [env.JWT_SECRET, ...(env.JWT_SECRET_PREVIOUS ? [env.JWT_SECRET_PREVIOUS] : [])],
          issuer: env.JWT_ISSUER,
        });
        req.user = { id: payload.sub, sessionId: payload.sid };
      } catch {
        if (!isPublic) throw unauthorized('Tu sesión expiró');
      }
    }
    if (isPublic) return true;
    if (!req.user) throw unauthorized();
    return true;
  }
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF: además de SameSite=Lax, todo método que modifica datos debe traer
 * X-Requested-With, que un formulario de otro sitio no puede enviar.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    if (UNSAFE.has(req.method) && !req.headers['x-requested-with']) {
      throw new AppError(HttpStatus.FORBIDDEN, 'csrf', 'Falta la cabecera X-Requested-With');
    }
    return true;
  }
}

const DEFAULT_LIMIT: RateLimitOptions = {
  name: 'global',
  limit: 300,
  windowMs: 60_000,
  by: ['user'],
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const specific = this.reflector.get<RateLimitOptions | undefined>(RATE_LIMIT, ctx.getHandler());
    for (const opts of specific ? [specific, DEFAULT_LIMIT] : [DEFAULT_LIMIT]) {
      for (const by of opts.by) {
        const key = this.keyFor(req, by);
        if (!key) continue;
        const retryAfter = this.limiter.hit(`${opts.name}:${by}:${key}`, opts.limit, opts.windowMs);
        if (retryAfter > 0) {
          req.res?.setHeader('Retry-After', Math.ceil(retryAfter / 1000));
          throw new AppError(
            HttpStatus.TOO_MANY_REQUESTS,
            'rate_limited',
            'Demasiados intentos. Espera un momento.',
          );
        }
      }
    }
    return true;
  }

  private keyFor(req: AppRequest, by: RateLimitOptions['by'][number]): string | undefined {
    if (by === 'ip') return req.ip ?? 'unknown';
    if (by === 'user') return req.user?.id ?? (req.ip ? `ip:${req.ip}` : undefined);
    const field = by.slice(5);
    const value = (req.body as Record<string, unknown> | undefined)?.[field];
    return typeof value === 'string' ? value.trim().toLowerCase() : undefined;
  }
}
