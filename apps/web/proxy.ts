import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC = ['/entrar', '/registro', '/renovar', '/unirse', '/design', '/offline'];

/**
 * Redirige a entrar si no hay sesión. Es solo comodidad de navegación:
 * la verificación real del token sigue en la API.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    return NextResponse.next();

  if (req.cookies.has('access')) return NextResponse.next();

  const next = encodeURIComponent(pathname + search);
  // Hay una sesión renovable (el refresh solo viaja a /api/v1/auth): se renueva en el cliente.
  const target = req.cookies.has('hb_session') ? `/renovar?next=${next}` : `/entrar?next=${next}`;
  return NextResponse.redirect(new URL(target, req.url));
}

export const config = {
  matcher: ['/((?!api|_next|icons|sw\\.js|manifest\\.webmanifest|favicon\\.ico|robots\\.txt).*)'],
};
