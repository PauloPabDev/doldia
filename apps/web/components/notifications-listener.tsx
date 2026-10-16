'use client';

import type { AppNotification } from '@habitos/contracts';
import { useToast } from '@habitos/ui';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { refreshSession } from '@/lib/api';

const UnreadContext = createContext(0);
export const useUnread = () => useContext(UnreadContext);

/** Bandeja en tiempo real: EventSource nativo contra el stream SSE de la API. */
export function NotificationsListener({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);
  const { show } = useToast();

  useEffect(() => {
    let es: EventSource | null = null;
    let retry = 2000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      es = new EventSource('/api/v1/notifications/stream');
      es.addEventListener('open', () => {
        retry = 2000;
      });
      es.addEventListener('unread', (e) => setUnread(JSON.parse((e as MessageEvent).data).unread));
      es.addEventListener('notification', (e) => {
        const n = JSON.parse((e as MessageEvent).data) as AppNotification;
        show({
          message: n.title,
          tone: n.type === 'achievement' ? 'celebrate' : 'social',
          accent: n.type === 'achievement' ? '🏅' : n.type === 'reaction' ? '💛' : undefined,
        });
      });
      es.addEventListener('error', async () => {
        es?.close();
        if (closed) return;
        // Puede ser el token de acceso vencido: se renueva una vez y se reconecta.
        await refreshSession();
        timer = setTimeout(connect, retry);
        retry = Math.min(retry * 2, 30_000);
      });
    };
    connect();
    return () => {
      closed = true;
      es?.close();
      if (timer) clearTimeout(timer);
    };
  }, [show]);

  return <UnreadContext.Provider value={unread}>{children}</UnreadContext.Provider>;
}
