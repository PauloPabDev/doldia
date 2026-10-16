import type { ZodType } from 'zod';

export const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Fallo de red (sin conexión): la cola offline decide qué hacer. */
export class NetworkError extends Error {}

let refreshing: Promise<boolean> | null = null;

/** Un único refresh en vuelo aunque varias peticiones reciban 401 a la vez. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'fetch' },
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => {
        refreshing = null;
      }, 0);
    });
  return refreshing;
}

interface ApiOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  schema?: ZodType<T>;
  /** Para auth: no intentar refrescar ni redirigir en 401. */
  skipRefresh?: boolean;
  signal?: AbortSignal;
}

async function send(path: string, opts: ApiOptions<unknown>) {
  try {
    return await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'fetch',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new NetworkError('Sin conexión');
  }
}

/**
 * fetch envuelto: añade X-Requested-With, maneja el 401 con un único refresh
 * y valida la respuesta con el esquema de contracts.
 */
export async function api<T = unknown>(path: string, opts: ApiOptions<T> = {}): Promise<T> {
  let res = await send(path, opts);
  if (res.status === 401 && !opts.skipRefresh) {
    if (await refreshSession()) {
      res = await send(path, opts);
    } else if (typeof window !== 'undefined') {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/entrar?next=${next}`);
    }
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const e = json?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'error', e.message ?? 'Algo salió mal', e.details);
  }
  if (opts.schema) {
    const parsed = opts.schema.safeParse(json);
    if (!parsed.success)
      throw new ApiError(500, 'invalid_response', 'Respuesta inesperada del servidor');
    return parsed.data;
  }
  return json as T;
}

export function errorMessage(err: unknown) {
  if (err instanceof NetworkError) return 'Sin conexión. Lo guardamos para enviarlo después.';
  if (err instanceof ApiError) return err.message;
  return 'Algo salió mal. Inténtalo de nuevo.';
}
