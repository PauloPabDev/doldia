'use client';

import type { Habit, LogStatus, Pact, TodayResponse } from '@habitos/contracts';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  HabitCard,
  Sheet,
  Textarea,
  useToast,
} from '@habitos/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useCallback, useEffect, useMemo, useOptimistic, useState } from 'react';
import { Celebration } from '@/components/celebration';
import { useSession } from '@/components/session';
import { useTransitionNavigate } from '@/components/view-transition';
import { api, errorMessage } from '@/lib/api';
import { checkIn, rewardMessage } from '@/lib/check-in';
import { greeting, localToday } from '@/lib/dates';
import { identity } from '@/lib/identities';
import { currentSubscription, enablePush, pushSupported } from '@/lib/push';

interface Props {
  initial: TodayResponse;
  pacts: Pact[];
  openHabitId?: string;
}

type Big = { emoji: string; title: string; body: string; askPush?: boolean };

function withLog(habit: Habit, status: LogStatus): Habit {
  const now = new Date().toISOString();
  return {
    ...habit,
    today: {
      id: `tmp-${habit.id}`,
      habitId: habit.id,
      localDate: '',
      status,
      value: null,
      note: null,
      createdAt: now,
    },
    streak:
      habit.kind === 'build' && (status === 'done' || status === 'min') && !habit.today
        ? { ...habit.streak, current: habit.streak.current + 1 }
        : habit.streak,
  };
}

export function TodayView({ initial, pacts, openHabitId }: Props) {
  const { me } = useSession();
  const router = useRouter();
  const navigate = useTransitionNavigate();
  const { show } = useToast();
  const [habits, setHabits] = useState(initial.habits);
  const [optimistic, applyOptimistic] = useOptimistic(
    habits,
    (list: Habit[], u: { id: string; status: LogStatus }) =>
      list.map((h) => (h.id === u.id ? withLog(h, u.status) : h)),
  );
  const [sheetFor, setSheetFor] = useState<Habit | null>(null);
  const [note, setNote] = useState('');
  const [celebrate, setCelebrate] = useState<Big | null>(null);
  const [snoozed, setSnoozed] = useState<string[]>([]);

  useEffect(() => setHabits(initial.habits), [initial.habits]);

  // Llegada desde una notificación: abre directamente el registro de ese hábito.
  useEffect(() => {
    const h = openHabitId && initial.habits.find((x) => x.id === openHabitId && !x.today);
    if (h) setSheetFor(h);
  }, [openHabitId, initial.habits]);

  // La cola offline se sincronizó: trae el estado real.
  useEffect(() => {
    const onQueue = () => router.refresh();
    window.addEventListener('habitos:queue', onQueue);
    return () => window.removeEventListener('habitos:queue', onQueue);
  }, [router]);

  const pending = useMemo(
    () =>
      optimistic
        .filter((h) => !h.today)
        .sort((a, b) => Number(snoozed.includes(a.id)) - Number(snoozed.includes(b.id))),
    [optimistic, snoozed],
  );
  const done = optimistic.filter((h) => h.today);
  const votes = done.filter((h) => h.today && ['done', 'min'].includes(h.today.status));

  const topIdentity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of votes) counts.set(h.identity, (counts.get(h.identity) ?? 0) + 1);
    const best = [...counts].sort((a, b) => b[1] - a[1])[0];
    return best ? { noun: identity(best[0]).noun, n: best[1] } : null;
  }, [votes]);

  const register = useCallback(
    (habit: Habit, status: LogStatus, extra: { note?: string | null } = {}) => {
      setSheetFor(null);
      setNote('');
      const wasFirstEver = !habits.some((h) => h.streak.best > 0 || h.today);
      startTransition(async () => {
        applyOptimistic({ id: habit.id, status });
        try {
          const result = await checkIn(habit.id, status, me.timezone, extra);
          if (result.kind === 'queued') {
            setHabits((list) => list.map((h) => (h.id === habit.id ? withLog(h, status) : h)));
            show({ message: 'Guardado sin conexión. Se enviará solo.', tone: 'default' });
            return;
          }
          const { response } = result;
          setHabits((list) =>
            list.map((h) =>
              h.id === habit.id
                ? {
                    ...h,
                    today: response.log,
                    streak: response.streak,
                    freedom:
                      h.kind === 'break'
                        ? { days: response.streak.current, saved: h.freedom?.saved ?? null }
                        : null,
                  }
                : h,
            ),
          );
          // El resumen del pacto viene del servidor: se refresca para contar este registro.
          router.refresh();
          const { reward } = response;
          const remaining = habits.filter((h) => !h.today && h.id !== habit.id).length;
          const label =
            status === 'relapse'
              ? 'Ayer no define hoy. Seguimos.'
              : status === 'skip'
                ? 'Comodín usado: tu racha está a salvo'
                : `Un voto más por ${identity(habit.identity).noun}`;
          show({ message: label, tone: 'celebrate', accent: rewardMessage(reward) });

          if (wasFirstEver && (status === 'done' || status === 'min')) {
            const subscribed = pushSupported() ? !!(await currentSubscription()) : true;
            setCelebrate({
              emoji: '🌱',
              title: '¡Tu primer voto!',
              body: `Así se construye ${identity(habit.identity).noun}: un día a la vez.`,
              askPush: !subscribed,
            });
          } else if (reward.levelUp) {
            setCelebrate({
              emoji: '⭐',
              title: reward.levelUp.title,
              body: `Subiste al nivel ${reward.levelUp.level}. Cada voto cuenta.`,
            });
          } else if (remaining === 0 && status !== 'relapse') {
            setCelebrate({
              emoji: '🎉',
              title: 'Todo hecho por hoy',
              body: 'Disfruta el resto del día. Mañana seguimos.',
            });
          }
          for (const a of reward.achievements)
            show({ message: `Logro: ${a.title}`, tone: 'celebrate', accent: '🏅' });
        } catch (err) {
          setHabits((list) => [...list]);
          show({ message: errorMessage(err), tone: 'danger' });
        }
      });
    },
    [applyOptimistic, habits, me.timezone, router, show],
  );

  const undo = async (habit: Habit) => {
    setSheetFor(null);
    try {
      await api(`/habits/${habit.id}/logs/${localToday(me.timezone)}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      show({ message: errorMessage(err), tone: 'danger' });
    }
  };

  const card = (h: Habit, i: number) => {
    const info = identity(h.identity);
    return (
      <HabitCard
        key={h.id}
        id={h.id}
        title={h.title}
        kind={h.kind}
        identityLabel={info.label}
        identityColor={info.color}
        state={h.today?.status ?? 'pending'}
        streak={h.streak.current}
        minVersion={h.minVersion}
        cue={[h.cueTime, h.cuePlace && `en ${h.cuePlace}`].filter(Boolean).join(' ') || null}
        freedomDays={h.freedom?.days}
        freedomSaved={
          h.freedom?.saved != null ? `${h.freedom.saved} ${h.savingsUnit ?? ''}`.trim() : null
        }
        highlight={i === 0 && done.length > 0}
        onCheckIn={() => register(h, 'done')}
        onOptions={() => setSheetFor(h)}
        onOpen={() => navigate(`/habitos/${h.id}`)}
        onSnooze={() => {
          setSnoozed((s) => [...s.filter((x) => x !== h.id), h.id]);
          show({ message: 'Lo dejamos para más tarde' });
        }}
      />
    );
  };

  const firstPact = pacts[0];

  return (
    <>
      <header className="page-header">
        <span className="page-header__eyebrow">
          {greeting(me.timezone)}, {me.displayName}
        </span>
        <h1>
          {topIdentity
            ? `Hoy votaste ${votes.length} ${votes.length === 1 ? 'vez' : 'veces'} por ${topIdentity.noun}`
            : optimistic.length
              ? '¿Por quién votas hoy?'
              : 'Empieza con un hábito'}
        </h1>
      </header>

      {optimistic.length === 0 ? (
        <EmptyState
          icon="seed"
          title="Tu primer hábito te espera"
          body="Elige quién quieres ser y empieza con la versión de 2 minutos."
          action={
            <Link href="/habitos/nuevo" className="hb-button hb-button--primary hb-button--lg">
              Crear hábito
            </Link>
          }
        />
      ) : (
        <>
          {pending.length > 0 ? (
            <section className="section" aria-labelledby="pendientes">
              <h2 id="pendientes" className="hb-visually-hidden">
                Pendientes
              </h2>
              <ul className="list">{pending.map(card)}</ul>
            </section>
          ) : (
            <Card tone="celebrate" className="stack" role="status">
              <strong>Todo hecho por hoy 🎉</strong>
              <span className="muted small">Cada registro fue un voto por quien quieres ser.</span>
            </Card>
          )}
          {done.length > 0 && (
            <section className="section" aria-labelledby="hechos">
              <h2 id="hechos" className="section__title muted">
                Hechos · {done.length}
              </h2>
              <ul className="list">{done.map(card)}</ul>
            </section>
          )}
        </>
      )}

      {firstPact ? (
        <Link
          href={`/pactos/${firstPact.id}`}
          className="pact-strip"
          style={{ '--color-accent': firstPact.accent } as React.CSSProperties}
        >
          <span className="pact-strip__avatars">
            {firstPact.members.slice(0, 5).map((m) => (
              <Avatar key={m.userId} name={m.displayName} size="sm" lit={m.loggedToday} />
            ))}
          </span>
          <span className="pact-strip__text">
            <strong>{firstPact.name}</strong>
            <span className="muted small">
              {firstPact.members.filter((m) => m.loggedToday).length} de {firstPact.members.length}{' '}
              ya registraron · racha de grupo {firstPact.groupStreak}
            </span>
          </span>
        </Link>
      ) : (
        optimistic.length > 0 && (
          <Card tone="social" className="stack">
            <strong>Los hábitos se sostienen mejor en grupo</strong>
            <span className="small">Crea un pacto e invita a 2 o 3 amigos por WhatsApp.</span>
            <Link href="/pactos?crear=1" className="hb-button hb-button--secondary">
              Crear un pacto
            </Link>
          </Card>
        )
      )}

      <Sheet open={!!sheetFor} onClose={() => setSheetFor(null)} title={sheetFor?.title ?? ''}>
        {sheetFor && (
          <div className="stack">
            {sheetFor.today ? (
              <Button variant="secondary" block onClick={() => undo(sheetFor)}>
                Deshacer el registro de hoy
              </Button>
            ) : sheetFor.kind === 'build' ? (
              <>
                <Button
                  size="lg"
                  block
                  onClick={() => register(sheetFor, 'done', { note: note || null })}
                >
                  Hecho
                </Button>
                {sheetFor.minVersion && (
                  <Button
                    size="lg"
                    variant="secondary"
                    block
                    onClick={() => register(sheetFor, 'min', { note: note || null })}
                  >
                    Versión de 2 min: {sheetFor.minVersion}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  block
                  disabled={sheetFor.streak.freezesLeft === 0}
                  onClick={() => register(sheetFor, 'skip')}
                >
                  Usar comodín ({sheetFor.streak.freezesLeft} esta semana)
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  block
                  onClick={() => register(sheetFor, 'done', { note: note || null })}
                >
                  Hoy me mantuve libre
                </Button>
                {sheetFor.substitute && (
                  <p className="muted small">Si aparece las ganas: {sheetFor.substitute}.</p>
                )}
                <Button
                  variant="secondary"
                  block
                  onClick={() => register(sheetFor, 'relapse', { note: note || null })}
                >
                  Tuve un tropiezo
                </Button>
                <p className="muted small">
                  {sheetFor.relapseVisibility === 'private'
                    ? 'Los tropiezos son privados: solo tú los ves.'
                    : 'Tu pacto verá este tropiezo para apoyarte.'}
                </p>
              </>
            )}
            {!sheetFor.today && (
              <Textarea
                label="Nota (opcional)"
                value={note}
                maxLength={280}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </div>
        )}
      </Sheet>

      {celebrate && (
        <Celebration
          emoji={celebrate.emoji}
          title={celebrate.title}
          body={celebrate.body}
          onClose={() => setCelebrate(null)}
          action={
            celebrate.askPush
              ? {
                  label: 'Activar recordatorios',
                  onClick: async () => {
                    setCelebrate(null);
                    const r = await enablePush().catch(() => 'denied' as const);
                    show({
                      message:
                        r === 'granted'
                          ? 'Te avisaremos a la hora de tu señal'
                          : 'Puedes activarlos luego en tu perfil',
                    });
                  },
                }
              : undefined
          }
        />
      )}
    </>
  );
}
