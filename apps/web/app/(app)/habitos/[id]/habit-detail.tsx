'use client';

import { type HabitDetail, habit as habitSchema, updateHabitInput } from '@habitos/contracts';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  HeatmapCalendar,
  Icon,
  Input,
  Select,
  Sheet,
  StreakFlame,
  useToast,
} from '@habitos/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { localToday } from '@/lib/dates';
import { identity } from '@/lib/identities';

export function HabitDetailView({ habit, timezone }: { habit: HabitDetail; timezone: string }) {
  const router = useRouter();
  const { show } = useToast();
  const info = identity(habit.identity);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: habit.title,
    minVersion: habit.minVersion ?? '',
    cueTime: habit.cueTime ?? '',
    cuePlace: habit.cuePlace ?? '',
    visibility: habit.visibility,
    relapseVisibility: habit.relapseVisibility,
  });
  const [busy, setBusy] = useState(false);

  const days = habit.logs
    .filter((l) => l.status === 'done' || l.status === 'min')
    .map((l) => ({ date: l.localDate, count: 1 }));
  const isBreak = habit.kind === 'break';

  async function save() {
    const parsed = updateHabitInput.safeParse({
      ...form,
      minVersion: form.minVersion || null,
      cueTime: form.cueTime || null,
      cuePlace: form.cuePlace || null,
    });
    if (!parsed.success)
      return show({
        message: parsed.error.issues[0]?.message ?? 'Revisa los datos',
        tone: 'danger',
      });
    setBusy(true);
    try {
      await api(`/habits/${habit.id}`, { method: 'PATCH', body: parsed.data, schema: habitSchema });
      setEditing(false);
      router.refresh();
      show({ message: 'Cambios guardados' });
    } catch (err) {
      show({ message: errorMessage(err), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    try {
      await api(`/habits/${habit.id}`, { method: 'DELETE' });
      show({ message: 'Hábito archivado. Tu XP y tu historial se conservan.' });
      router.push('/hoy');
      router.refresh();
    } catch (err) {
      show({ message: errorMessage(err), tone: 'danger' });
    }
  }

  return (
    <>
      <Link href="/hoy" className="back-link">
        <Icon name="chevron-left" size={20} /> Hoy
      </Link>
      <header className="page-header" style={{ viewTransitionName: `habit-${habit.id}` }}>
        <span className="page-header__eyebrow">
          <Badge tone={isBreak ? 'calm' : 'accent'}>{info.label}</Badge>
        </span>
        <h1>{habit.title}</h1>
        <p className="muted">
          {isBreak
            ? `${habit.freedom?.days ?? 0} días de libertad${habit.freedom?.saved != null ? ` · ${habit.freedom.saved} ${habit.savingsUnit ?? ''} ganados` : ''}`
            : `${habit.votes} ${habit.votes === 1 ? 'voto' : 'votos'} por ${info.noun}`}
        </p>
      </header>

      <div className="stat-row">
        <div className="stat">
          <strong>
            {isBreak ? (habit.freedom?.days ?? 0) : <StreakFlame count={habit.streak.current} />}
          </strong>
          <span>{isBreak ? 'días libres' : 'racha actual'}</span>
        </div>
        <div className="stat">
          <strong>{habit.streak.best}</strong>
          <span>récord</span>
        </div>
        <div className="stat">
          <strong>{isBreak ? habit.votes : habit.streak.freezesLeft}</strong>
          <span>{isBreak ? 'días resistidos' : 'comodines'}</span>
        </div>
      </div>

      {!isBreak && (
        <section className="section">
          <h2 className="section__title">Tus votos</h2>
          <HeatmapCalendar
            days={days}
            endDate={localToday(timezone)}
            label={`Registros de ${habit.title}`}
          />
        </section>
      )}

      <Card className="stack">
        {habit.minVersion && (
          <span>
            <strong>Versión de 2 min:</strong> {habit.minVersion}
          </span>
        )}
        {(habit.cueTime || habit.cuePlace) && (
          <span>
            <strong>Señal:</strong>{' '}
            {[habit.cueTime, habit.cuePlace && `en ${habit.cuePlace}`].filter(Boolean).join(' ')}
          </span>
        )}
        {isBreak && habit.triggers.length > 0 && (
          <span>
            <strong>Detonantes:</strong> {habit.triggers.join(', ')}
          </span>
        )}
        {isBreak && habit.substitute && (
          <span>
            <strong>En su lugar:</strong> {habit.substitute}
          </span>
        )}
        <span className="muted small">
          {habit.visibility === 'private'
            ? 'Solo tú lo ves'
            : habit.visibility === 'pact'
              ? 'Lo ven tus pactos'
              : 'Lo ven tus amigos'}
          {isBreak &&
            ` · tropiezos ${habit.relapseVisibility === 'private' ? 'privados' : 'visibles para tu pacto'}`}
        </span>
      </Card>

      <div className="stack">
        <Button variant="secondary" block onClick={() => setEditing(true)}>
          Editar
        </Button>
        <Button variant="danger" block onClick={archive}>
          Archivar hábito
        </Button>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Editar hábito">
        <div className="stack">
          <Input
            label="Nombre"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          {!isBreak && (
            <Input
              label="Versión de 2 minutos"
              value={form.minVersion}
              onChange={(e) => setForm({ ...form, minVersion: e.target.value })}
            />
          )}
          <Input
            label="Hora"
            type="time"
            value={form.cueTime}
            onChange={(e) => setForm({ ...form, cueTime: e.target.value })}
          />
          <Input
            label="Lugar"
            value={form.cuePlace}
            onChange={(e) => setForm({ ...form, cuePlace: e.target.value })}
          />
          <Select
            label="Visibilidad"
            value={form.visibility}
            onChange={(e) =>
              setForm({ ...form, visibility: e.target.value as typeof form.visibility })
            }
          >
            <option value="pact">Mis pactos</option>
            <option value="friends">Mis amigos</option>
            <option value="private">Solo yo</option>
          </Select>
          {isBreak && (
            <Checkbox
              label="Mi pacto puede ver mis tropiezos"
              checked={form.relapseVisibility === 'pact'}
              onChange={(e) =>
                setForm({ ...form, relapseVisibility: e.target.checked ? 'pact' : 'private' })
              }
            />
          )}
          <Button size="lg" block loading={busy} onClick={save}>
            Guardar
          </Button>
        </div>
      </Sheet>
    </>
  );
}
