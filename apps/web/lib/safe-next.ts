/** Solo rutas internas: evita redirecciones abiertas con ?next=https://... */
export function safeNext(next: string | null | undefined, fallback = '/hoy') {
  if (!next?.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
