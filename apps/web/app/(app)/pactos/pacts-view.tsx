'use client';

import {
  createPactInput,
  type Habit,
  PACT_ACCENTS,
  type Pact,
  pact as pactSchema,
} from '@habitos/contracts';
import { Avatar, Button, Card, Checkbox, EmptyState, Input, Sheet, useToast } from '@habitos/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';

export function PactsView({
  pacts,
  habits,
  startCreating,
}: {
  pacts: Pact[];
  habits: Habit[];
  startCreating: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(startCreating);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [accent, setAccent] = useState<(typeof PACT_ACCENTS)[number]>(PACT_ACCENTS[0]);
  const [shared, setShared] = useState<string[]>(
    habits.filter((h) => h.visibility !== 'private').map((h) => h.id),
  );
  const [busy, setBusy] = useState(false);

  async function create() {
    const parsed = createPactInput.safeParse({
      name,
      goal: goal || null,
      accent,
      habitIds: shared,
    });
    if (!parsed.success)
      return show({
        message: parsed.error.issues[0]?.message ?? 'Revisa los datos',
        tone: 'danger',
      });
    setBusy(true);
    try {
      const p = await api('/pacts', { method: 'POST', body: parsed.data, schema: pactSchema });
      router.push(`/pactos/${p.id}?nuevo=1`);
    } catch (err) {
      show({ message: errorMessage(err), tone: 'danger' });
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header__row">
          <h1>Pactos</h1>
          {pacts.length > 0 && (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Nuevo
            </Button>
          )}
        </div>
        <p className="muted">Grupos de 3 a 8 amigos que se acompañan.</p>
      </header>

      {pacts.length === 0 ? (
        <EmptyState
          icon="hands"
          title="Crea tu primer pacto"
          body="Un hábito se sostiene mejor cuando lo ve un grupo pequeño."
          action={<Button onClick={() => setOpen(true)}>Crear pacto</Button>}
        />
      ) : (
        <ul className="list">
          {pacts.map((p) => (
            <li
              key={p.id}
              style={{ listStyle: 'none', '--color-accent': p.accent } as React.CSSProperties}
            >
              <Link href={`/pactos/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Card className="stack">
                  <div className="page-header__row">
                    <strong>{p.name}</strong>
                    <span className="small muted">Racha de grupo {p.groupStreak}</span>
                  </div>
                  <div className="chain">
                    {p.members.map((m) => (
                      <Avatar key={m.userId} name={m.displayName} size="sm" lit={m.loggedToday} />
                    ))}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Nuevo pacto">
        <div className="stack">
          <Input
            label="Nombre"
            placeholder="Madrugadores"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Meta (opcional)"
            placeholder="Movernos un poco cada día"
            value={goal}
            maxLength={140}
            onChange={(e) => setGoal(e.target.value)}
          />
          <fieldset className="stack" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="small" style={{ fontWeight: 500, marginBottom: 'var(--space-2)' }}>
              Color del pacto
            </legend>
            <div className="swatches" role="radiogroup" aria-label="Color del pacto">
              {PACT_ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={accent === c}
                  aria-label={`Color ${c}`}
                  className="swatch"
                  style={{ background: c }}
                  onClick={() => setAccent(c)}
                />
              ))}
            </div>
          </fieldset>
          {habits.length > 0 && (
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="small" style={{ fontWeight: 500 }}>
                Hábitos que compartes
              </legend>
              {habits.map((h) => (
                <Checkbox
                  key={h.id}
                  label={h.title}
                  description={
                    h.kind === 'break'
                      ? 'Los tropiezos siguen siendo privados salvo que lo cambies'
                      : undefined
                  }
                  checked={shared.includes(h.id)}
                  onChange={(e) =>
                    setShared((s) =>
                      e.target.checked ? [...s, h.id] : s.filter((x) => x !== h.id),
                    )
                  }
                />
              ))}
            </fieldset>
          )}
          <Button size="lg" block loading={busy} onClick={create} disabled={!name.trim()}>
            Crear e invitar
          </Button>
        </div>
      </Sheet>
    </>
  );
}
