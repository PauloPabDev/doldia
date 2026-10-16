import type { Response } from 'express';
import { loadEnv } from '../../config';
import { ACCESS_TTL_SECONDS, IssuedTokens, REFRESH_TTL_MS } from './auth.service';

export const REFRESH_COOKIE = 'refresh';
/** Pista no sensible para que el front sepa que hay una sesión renovable. */
export const SESSION_HINT_COOKIE = 'hb_session';
export const REFRESH_PATH = '/api/v1/auth';

function isSecure() {
  const url = new URL(loadEnv().PUBLIC_URL);
  return url.protocol === 'https:' || url.hostname === 'localhost';
}

export function setAuthCookies(res: Response, tokens: IssuedTokens) {
  const secure = isSecure();
  // El acceso usa Path=/ para que Next lo reenvíe al renderizar en servidor.
  res.cookie('access', tokens.access, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refresh, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: REFRESH_PATH,
    maxAge: REFRESH_TTL_MS,
  });
  res.cookie(SESSION_HINT_COOKIE, '1', {
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TTL_MS,
  });
}

export function clearAuthCookies(res: Response) {
  const secure = isSecure();
  res.clearCookie('access', { httpOnly: true, secure, sameSite: 'lax', path: '/' });
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: REFRESH_PATH });
  res.clearCookie(SESSION_HINT_COOKIE, { secure, sameSite: 'lax', path: '/' });
}
