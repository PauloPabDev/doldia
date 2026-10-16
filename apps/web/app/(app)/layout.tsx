import { me as meSchema } from '@habitos/contracts';
import type { ReactNode } from 'react';
import { AppNav } from '@/components/app-nav';
import { NotificationsListener } from '@/components/notifications-listener';
import { SessionProvider } from '@/components/session';
import { ViewTransitionResolver } from '@/components/view-transition';
import { serverApi } from '@/lib/server-api';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await serverApi('/me', { schema: meSchema, next: '/hoy' });
  return (
    <SessionProvider me={me}>
      <NotificationsListener>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <main id="contenido" className="page">
          {children}
        </main>
        <AppNav />
        <ViewTransitionResolver />
      </NotificationsListener>
    </SessionProvider>
  );
}
