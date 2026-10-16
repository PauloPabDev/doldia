'use client';

import type { Habit } from '@habitos/contracts';
import { me as meSchema } from '@habitos/contracts';
import { Button, Card, CheckInButton, useToast } from '@habitos/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Celebration } from '@/components/celebration';
import { HabitWizard } from '@/components/habit-wizard';
import { useSession } from '@/components/session';
import { api, errorMessage } from '@/lib/api';
import { checkIn } from '@/lib/check-in';
import { identity } from '@/lib/identities';
import { enablePush, isIosWithoutInstall, pushSupported } from '@/lib/push';

/**
 * Onboarding con un objetivo: primer registro en menos de 2 minutos.
 * Identidad → plantilla → hora → versión mínima ahora → permisos e instalación.
 */
export function Onboarding() {
  const router = useRouter();
  const { me, setMe } = useSession();
  const { show } = useToast();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [checked, setChecked] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [phase, setPhase] = useState<'habit' | 'first' | 'permissions'>('habit');

  const finish = async () => {
    try {
      setMe(await api('/me', { method: 'PATCH', body: { onboarded: true }, schema: meSchema }));
    } catch {
      /* no bloquea la entrada */
    }
    router.push('/hoy');
    router.refresh();
  };

  if (phase === 'habit') {
    return (
      <HabitWizard
        quick
        onCreated={(h) => {
          setHabit(h);
          setPhase('first');
        }}
      />
    );
  }

  if (phase === 'first' && habit) {
    return (
      <section
        className="stack"
        style={
          {
            '--stack-gap': 'var(--space-6)',
            justifyItems: 'center',
            textAlign: 'center',
          } as React.CSSProperties
        }
      >
        <h1>Hazlo ahora, en versión mínima</h1>
        <p className="muted">
          {habit.minVersion ? `“${habit.minVersion}”. ` : ''}Así ganas tu primer voto por{' '}
          {identity(habit.identity).noun}.
        </p>
        <CheckInButton
          state={checked ? 'min' : 'pending'}
          label={habit.minVersion ?? habit.title}
          disabled={checked}
          onCheckIn={async () => {
            setChecked(true);
            try {
              await checkIn(habit.id, habit.minVersion ? 'min' : 'done', me.timezone);
              setCelebrate(true);
            } catch (err) {
              setChecked(false);
              show({ message: errorMessage(err), tone: 'danger' });
            }
          }}
        />
        <Button variant="ghost" onClick={() => setPhase('permissions')}>
          Lo haré más tarde
        </Button>
        {celebrate && (
          <Celebration
            emoji="🌱"
            title="¡Tu primer voto!"
            body="+30 XP. Así empieza todo: pequeño y hoy."
            onClose={() => {
              setCelebrate(false);
              setPhase('permissions');
            }}
          />
        )}
      </section>
    );
  }

  return (
    <section className="stack" style={{ '--stack-gap': 'var(--space-6)' } as React.CSSProperties}>
      <h1>Que la app te encuentre a ti</h1>
      <p className="muted">
        Un aviso a la hora de tu señal hace el hábito obvio. Máximo 4 al día y nunca de noche.
      </p>
      {pushSupported() && !isIosWithoutInstall() && (
        <Button
          size="lg"
          block
          onClick={async () => {
            const r = await enablePush().catch(() => 'denied' as const);
            show({
              message:
                r === 'granted'
                  ? 'Recordatorios activados'
                  : 'Puedes activarlos luego en tu perfil',
            });
          }}
        >
          Activar recordatorios
        </Button>
      )}
      <Card tone="calm" className="stack">
        <strong>Instálala en tu pantalla de inicio</strong>
        {isIosWithoutInstall() ? (
          <span className="small">
            En iPhone toca Compartir y luego “Agregar a inicio”. En iOS los recordatorios solo
            funcionan con la app instalada.
          </span>
        ) : (
          <span className="small">
            En el menú del navegador elige “Instalar app” o “Agregar a pantalla de inicio”.
          </span>
        )}
      </Card>
      <Button size="lg" variant="secondary" block onClick={finish}>
        Ir a Hoy
      </Button>
    </section>
  );
}
