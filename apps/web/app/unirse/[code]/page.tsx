import type { InvitePreview } from '@habitos/contracts';
import { Avatar, EmptyState } from '@habitos/ui';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { publicApi } from '@/lib/server-api';
import { JoinButton } from './join-button';
import '../../(auth)/auth.css';

export const metadata: Metadata = { title: 'Te invitaron a un pacto' };

/** Quien llega por invitación aterriza en el pacto, con la cara de quien lo invitó. */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { data: invite } = await publicApi<InvitePreview>(
    `/pacts/invite/${encodeURIComponent(code)}`,
  );
  const signedIn = (await cookies()).has('hb_session');
  const here = `/unirse/${code}`;

  if (!invite) {
    return (
      <main className="auth">
        <EmptyState
          icon="link"
          title="Esta invitación ya no funciona"
          body="Pide a tu amigo un enlace nuevo."
          action={<Link href="/hoy">Ir a la app</Link>}
        />
      </main>
    );
  }

  return (
    <main className="auth" style={{ '--color-accent': invite.accent } as React.CSSProperties}>
      <div className="auth__invite">
        <Avatar name={invite.invitedBy} size="lg" />
        <p>
          <strong>{invite.invitedBy}</strong> te invita a su pacto
        </p>
      </div>
      <header className="page-header">
        <h1>{invite.name}</h1>
        {invite.goal && <p className="muted">{invite.goal}</p>}
        <p className="small muted">
          {invite.memberCount} {invite.memberCount === 1 ? 'miembro' : 'miembros'}:{' '}
          {invite.members.join(', ')}
        </p>
      </header>
      {invite.full ? (
        <p>Este pacto ya está completo (8 personas).</p>
      ) : signedIn ? (
        <JoinButton code={code} />
      ) : (
        <div className="stack">
          <Link
            className="hb-button hb-button--primary hb-button--lg hb-button--block"
            href={`/registro?next=${encodeURIComponent(here)}`}
          >
            Crear cuenta y unirme
          </Link>
          <Link
            className="hb-button hb-button--ghost hb-button--block"
            href={`/entrar?next=${encodeURIComponent(here)}`}
          >
            Ya tengo cuenta
          </Link>
        </div>
      )}
    </main>
  );
}
