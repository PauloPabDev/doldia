import { createHmac, timingSafeEqual } from 'node:crypto';

export interface AccessPayload {
  sub: string;
  sid: string;
  iat: number;
  exp: number;
  iss: string;
}

export class JwtError extends Error {}

const HEADER = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string, secret: string) {
  return createHmac('sha256', secret).update(data).digest();
}

export function signJwt(
  claims: { sub: string; sid: string },
  opts: { secret: string; issuer: string; ttlSeconds: number; now?: number },
): string {
  const iat = Math.floor((opts.now ?? Date.now()) / 1000);
  const payload: AccessPayload = { ...claims, iat, exp: iat + opts.ttlSeconds, iss: opts.issuer };
  const body = `${HEADER}.${base64url(JSON.stringify(payload))}`;
  return `${body}.${sign(body, opts.secret).toString('base64url')}`;
}

/**
 * Verifica firma, algoritmo, emisor y expiración. Acepta varios secretos
 * (actual y anterior) para rotar JWT_SECRET sin cerrar sesiones.
 */
export function verifyJwt(
  token: string,
  opts: { secrets: string[]; issuer: string; now?: number },
): AccessPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('Formato inválido');
  const [h, p, s] = parts as [string, string, string];

  let header: unknown;
  let payload: Partial<AccessPayload>;
  try {
    header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  } catch {
    throw new JwtError('Formato inválido');
  }
  if (!header || typeof header !== 'object' || (header as { alg?: unknown }).alg !== 'HS256') {
    throw new JwtError('Algoritmo no permitido');
  }

  const given = Buffer.from(s, 'base64url');
  const valid = opts.secrets.some((secret) => {
    const expected = sign(`${h}.${p}`, secret);
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
  if (!valid) throw new JwtError('Firma inválida');

  if (typeof payload.exp !== 'number') throw new JwtError('Token sin expiración');
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (payload.exp <= now) throw new JwtError('Token expirado');
  if (payload.iss !== opts.issuer) throw new JwtError('Emisor inválido');
  if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
    throw new JwtError('Payload inválido');
  }
  return payload as AccessPayload;
}
