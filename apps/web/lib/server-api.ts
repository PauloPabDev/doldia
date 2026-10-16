import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ZodType } from 'zod';

const INTERNAL = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3101';

/**
 * Lectura desde Server Components: llama a la API por la red interna y
 * reenvía la cookie de acceso del usuario. La verificación real es de la API.
 */
export async function serverApi<T>(
  path: string,
  opts: { schema?: ZodType<T>; next: string },
): Promise<T> {
  const jar = await cookies();
  const access = jar.get('access')?.value;
  if (!access) redirect(`/renovar?next=${encodeURIComponent(opts.next)}`);

  const res = await fetch(`${INTERNAL}/api/v1${path}`, {
    headers: { cookie: `access=${access}`, 'x-requested-with': 'fetch' },
    cache: 'no-store',
  });
  if (res.status === 401) redirect(`/renovar?next=${encodeURIComponent(opts.next)}`);
  if (res.status === 404) {
    const { notFound } = await import('next/navigation');
    notFound();
  }
  if (!res.ok) throw new Error(`La API respondió ${res.status} en ${path}`);
  const json = await res.json();
  return opts.schema ? opts.schema.parse(json) : (json as T);
}

/** Lectura pública (sin sesión), por ejemplo la vista previa de una invitación. */
export async function publicApi<T>(path: string): Promise<{ status: number; data: T | null }> {
  const res = await fetch(`${INTERNAL}/api/v1${path}`, { cache: 'no-store' });
  return { status: res.status, data: res.ok ? ((await res.json()) as T) : null };
}
