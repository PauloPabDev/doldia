'use client';

import {
  type FeedItem,
  type FeedResponse,
  feedResponse,
  type Habit,
  NUDGE_MESSAGES,
  type Pact,
  REACTIONS,
} from '@habitos/contracts';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Garden,
  Icon,
  NudgeButton,
  PactFeedItem,
  ReactionBar,
  Sheet,
  useToast,
} from '@habitos/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Celebration } from '@/components/celebration';
import { InviteShare } from '@/components/invite-share';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/dates';

interface Props {
  pact: Pact;
  feed: FeedResponse;
  meId: string;
  habits: Habit[];
  justCreated: boolean;
  welcome: boolean;
}

export function PactView({ pact, feed: initialFeed, meId, habits, justCreated, welcome }: Props) {
  const router = useRouter();
  const { show } = useToast();
  const [items, setItems] = useState<FeedItem[]>(initialFeed.items);
  const [cursor, setCursor] = useState(initialFeed.nextCursor);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(pact.myHabitIds);
  const [celebrate, setCelebrate] = useState(welcome);
  const me = pact.members.find((m) => m.userId === meId);
  const isOwner = me?.role === 'owner';
  const loggedCount = pact.members.filter((m) => m.loggedToday).length;
  const monthly = Math.min(1, pact.monthlyCount / Math.max(1, pact.monthlyTarget));

  const toggleReaction = async (logId: string, emoji: string, mine: boolean) => {
    // Optimista: la reacción aparece al instante.
    setItems((list) =>
      list.map((it) => {
        if (it.logId !== logId) return it;
        const existing = it.reactions.find((r) => r.emoji === emoji);
        let reactions = it.reactions;
        if (mine) {
          reactions = reactions
            .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r))
            .filter((r) => r.count > 0);
        } else if (existing) {
          reactions = reactions.map((r) =>
            r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r,
          );
        } else {
          reactions = [...reactions, { emoji, count: 1, mine: true }];
        }
        return { ...it, reactions };
      }),
    );
    try {
      if (mine)
        await api(`/logs/${logId}/reactions/${encodeURIComponent(emoji)}`, { method: 'DELETE' });
      else await api(`/logs/${logId}/reactions`, { method: 'POST', body: { emoji } });
    } catch (err) {
      show({ message: errorMessage(err), tone: 'danger' });
      router.refresh();
    }
  };

  const loadMore = async () => {
    if (!cursor) return;
    try {
      const page = await api(`/pacts/${pact.id}/feed?cursor=${cursor}`, { schema: feedResponse });
      setItems((list) => [...list, ...page.items]);
      setCursor(page.nextCursor);
    } catch (err) {
      show({ message: errorMessage(err), tone: 'danger' });
    }
  };

  const saveShared = async () => {
    try {
      await api(`/pacts/${pact.id}/habits`, { method: 'PUT', body: { habitIds: shared } });
      setSharing(false);
      router.refresh();
    } catch (err) {
      show({ message: errorMessage(err), tone: 'danger' });
    }
  };

  const leave = async () => {
    try {
      await api(`/pacts/${pact.id}/members/me`, { method: 'DELETE' });
      router.push('/pactos');
      router.refresh();
    } catch (err) {
      show({ message: errorMessage(err), tone: 'danger' });
    }
  };

  const pendingFriends = pact.members.filter(
    (m) => m.userId !== meId && m.habits.some((h) => !h.loggedToday),
  );

  return (
    // Tema por pacto: al entrar, la interfaz cambia el token --color-accent.
    <div
      className="stack"
      style={
        { '--color-accent': pact.accent, '--stack-gap': 'var(--space-6)' } as React.CSSProperties
      }
    >
      <Link href="/pactos" className="back-link">
        <Icon name="chevron-left" size={20} /> Pactos
      </Link>
      <header className="page-header">
        <h1>{pact.name}</h1>
        {pact.goal && <p className="muted">{pact.goal}</p>}
        <p className="small muted">
          {pact.groupStreak > 0
            ? `El pacto lleva ${pact.groupStreak} ${pact.groupStreak === 1 ? 'día' : 'días'} juntos`
            : 'Hoy empieza la racha del grupo'}
        </p>
      </header>

      <Garden growth={pact.garden} members={pact.members.length} />

      <section className="section" aria-labelledby="cadena">
        <h2 id="cadena" className="section__title">
          Hoy · {loggedCount} de {pact.members.length}
        </h2>
        <div className="chain">
          {pact.members.map((m) => (
            <span key={m.userId} className="chain__member">
              <Avatar name={m.displayName} lit={m.loggedToday} />
              {m.userId === meId ? 'Tú' : m.displayName}
            </span>
          ))}
        </div>
      </section>

      <Card className="stack">
        <div className="page-header__row">
          <strong>Meta del mes</strong>
          <span className="small muted">
            {pact.monthlyCount} / {pact.monthlyTarget}
          </span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Meta cooperativa del mes"
          aria-valuemin={0}
          aria-valuemax={pact.monthlyTarget}
          aria-valuenow={pact.monthlyCount}
        >
          <span style={{ inlineSize: `${Math.round(monthly * 100)}%` }} />
        </div>
      </Card>

      {pact.inviteCode && pact.members.length < 8 && (
        <Card tone="social" className="stack">
          <strong>
            {pact.members.length < 3 ? 'Suma a 2 o 3 amigos' : 'Invita a alguien más'}
          </strong>
          <InviteShare code={pact.inviteCode} pactName={pact.name} />
        </Card>
      )}

      {pendingFriends.length > 0 && (
        <section className="section" aria-labelledby="animar">
          <h2 id="animar" className="section__title">
            Dales ánimo
          </h2>
          {pendingFriends.map((m) => {
            const h = m.habits.find((x) => !x.loggedToday);
            if (!h) return null;
            return (
              <div key={m.userId} className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small">
                  {m.displayName}: {h.title}
                </span>
                <NudgeButton
                  name={m.displayName}
                  messages={NUDGE_MESSAGES}
                  onNudge={async (message) => {
                    try {
                      await api('/nudges', {
                        method: 'POST',
                        body: { toUserId: m.userId, habitId: h.id, message },
                      });
                    } catch (err) {
                      show({ message: errorMessage(err), tone: 'danger' });
                      throw err;
                    }
                  }}
                />
              </div>
            );
          })}
        </section>
      )}

      <section className="section" aria-labelledby="actividad">
        <h2 id="actividad" className="section__title">
          Actividad
        </h2>
        {items.length === 0 ? (
          <EmptyState
            icon="sprout"
            title="Aún no hay registros"
            body="El primer registro del grupo hará crecer el jardín."
          />
        ) : (
          <ul className="list" style={{ gap: 0 }}>
            {items.map((it) => (
              <PactFeedItem
                key={it.logId}
                name={it.user.id === meId ? 'Tú' : it.user.displayName}
                habitTitle={it.habit.title}
                status={it.status}
                kind={it.habit.kind}
                when={timeAgo(it.createdAt)}
                note={it.note}
              >
                <ReactionBar
                  reactions={it.reactions}
                  options={REACTIONS}
                  onToggle={(emoji, mine) => toggleReaction(it.logId, emoji, mine)}
                />
              </PactFeedItem>
            ))}
          </ul>
        )}
        {cursor && (
          <Button variant="ghost" onClick={loadMore}>
            Ver más
          </Button>
        )}
      </section>

      <div className="stack">
        <Button variant="secondary" block onClick={() => setSharing(true)}>
          Elegir qué hábitos comparto
        </Button>
        {isOwner && pact.inviteCode && (
          <Button
            variant="ghost"
            block
            onClick={async () => {
              await api(`/pacts/${pact.id}/invite`, { method: 'POST' });
              show({ message: 'Nuevo enlace creado. El anterior ya no funciona.' });
              router.refresh();
            }}
          >
            Cambiar enlace de invitación
          </Button>
        )}
        <Button variant="danger" block onClick={leave}>
          Salir del pacto
        </Button>
      </div>

      <Sheet open={sharing} onClose={() => setSharing(false)} title="Hábitos que compartes">
        <div className="stack">
          {habits.map((h) => (
            <Checkbox
              key={h.id}
              label={h.title}
              checked={shared.includes(h.id)}
              onChange={(e) =>
                setShared((s) => (e.target.checked ? [...s, h.id] : s.filter((x) => x !== h.id)))
              }
            />
          ))}
          <Button size="lg" block onClick={saveShared}>
            Guardar
          </Button>
        </div>
      </Sheet>

      {(celebrate || justCreated) && (
        <Celebration
          emoji={justCreated ? '🤝' : '👋'}
          title={justCreated ? 'Pacto creado' : `Te damos la bienvenida a ${pact.name}`}
          body={
            justCreated
              ? 'Invita a 2 o 3 amigos: el enlace los lleva directo aquí.'
              : 'Tu grupo ya sabe que llegaste. Tu primer registro aparecerá en su feed.'
          }
          onClose={() => {
            setCelebrate(false);
            router.replace(`/pactos/${pact.id}`);
          }}
        />
      )}
    </div>
  );
}
