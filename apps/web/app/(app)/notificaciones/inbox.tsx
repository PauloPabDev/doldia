'use client';

import type { NotificationsResponse } from '@habitos/contracts';
import { Card, EmptyState, Icon } from '@habitos/ui';
import Link from 'next/link';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/dates';

export function Inbox({ initial }: { initial: NotificationsResponse }) {
  useEffect(() => {
    if (initial.unread > 0)
      void api('/notifications/read', { method: 'POST', body: {} }).catch(() => undefined);
  }, [initial.unread]);

  return (
    <>
      <Link href="/perfil" className="back-link">
        <Icon name="chevron-left" size={20} /> Perfil
      </Link>
      <header className="page-header">
        <h1>Notificaciones</h1>
      </header>
      {initial.items.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Todo tranquilo"
          body="Aquí verás reacciones, empujones y logros."
        />
      ) : (
        <ul className="list">
          {initial.items.map((n) => (
            <li key={n.id} style={{ listStyle: 'none' }}>
              <Card
                tone={n.readAt ? 'default' : 'accent'}
                className="stack"
                style={{ '--stack-gap': 'var(--space-1)' } as React.CSSProperties}
              >
                {n.url ? (
                  <Link href={n.url} style={{ color: 'inherit' }}>
                    <strong>{n.title}</strong>
                  </Link>
                ) : (
                  <strong>{n.title}</strong>
                )}
                <span className="small">{n.body}</span>
                <span className="small muted">{timeAgo(n.createdAt)}</span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
