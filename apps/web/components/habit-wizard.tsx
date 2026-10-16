'use client';

import {
  type CreateHabitInput,
  createHabitInput,
  type Habit,
  habit as habitSchema,
  IDENTITIES,
  type IdentityKey,
} from '@habitos/contracts';
import { Button, Checkbox, Icon, type IconName, Input, Select } from '@habitos/ui';
import { useMemo, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { TEMPLATES } from '@/lib/identities';

interface Props {
  /** Onboarding: solo identidad, plantilla y hora. */
  quick?: boolean;
  existing?: Habit[];
  onCreated: (habit: Habit) => void;
}

const ICONS: Record<string, IconName> = {
  book: 'book',
  run: 'run',
  leaf: 'leaf',
  target: 'target',
  wave: 'wave',
  spark: 'spark',
  feather: 'feather',
};

export function HabitWizard({ quick, existing = [], onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState<IdentityKey | null>(null);
  const [form, setForm] = useState<Partial<CreateHabitInput>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const steps = quick ? 3 : 4;

  const set = <K extends keyof CreateHabitInput>(key: K, value: CreateHabitInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const chooseIdentity = (key: IdentityKey) => {
    setIdentity(key);
    // Plantilla ya rellena con su versión de 2 minutos: solo falta la hora.
    const t = TEMPLATES.find((x) => x.identity === key) ?? TEMPLATES[0];
    if (!t) return;
    setForm({
      kind: t.kind,
      identity: key,
      title: t.title,
      minVersion: t.minVersion,
      cueTime: t.cueTime,
      cuePlace: t.cuePlace,
      visibility: t.kind === 'break' ? 'private' : 'pact',
    });
    setStep(1);
  };

  const stackOptions = useMemo(() => existing.filter((h) => h.kind === 'build'), [existing]);

  async function create() {
    const parsed = createHabitInput.safeParse({
      ...form,
      minVersion: form.minVersion || null,
      cuePlace: form.cuePlace || null,
      cueTime: form.cueTime || null,
      substitute: form.substitute || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onCreated(await api('/habits', { method: 'POST', body: parsed.data, schema: habitSchema }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const next = () => (step + 1 >= steps ? create() : setStep(step + 1));
  const isBreak = form.kind === 'break';

  return (
    <div className="stack" style={{ '--stack-gap': 'var(--space-6)' } as React.CSSProperties}>
      <p className="hb-visually-hidden" aria-live="polite">{`Paso ${step + 1} de ${steps}`}</p>
      <div className="steps" aria-hidden="true">
        {Array.from({ length: steps }, (_, i) => (
          <span key={i} data-done={i <= step || undefined} />
        ))}
      </div>

      {step === 0 && (
        <section className="stack">
          <h1>¿Quién quieres ser?</h1>
          <p className="muted">Los hábitos duran cuando son parte de tu identidad.</p>
          <div className="choice-grid">
            {(
              Object.entries(IDENTITIES) as Array<[IdentityKey, (typeof IDENTITIES)[IdentityKey]]>
            ).map(([key, info]) => (
              <button
                key={key}
                type="button"
                className="choice"
                aria-pressed={identity === key}
                onClick={() => chooseIdentity(key)}
              >
                <span className="choice__icon" style={{ background: info.color }}>
                  <Icon name={ICONS[info.icon] ?? 'star'} />
                </span>
                <span className="choice__title">{info.label}</span>
                <span className="muted small">Quiero {info.noun}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && identity && (
        <section className="stack">
          <h1>{isBreak ? 'Lo que quieres dejar' : 'Tu primer paso'}</h1>
          {!quick && (
            <div className="choice-grid" role="radiogroup" aria-label="Tipo de hábito">
              <button
                type="button"
                role="radio"
                className="choice"
                aria-checked={!isBreak}
                onClick={() => set('kind', 'build')}
              >
                <span className="choice__title">Construir</span>
                <span className="muted small">Hacerlo más</span>
              </button>
              <button
                type="button"
                role="radio"
                className="choice"
                aria-checked={isBreak}
                onClick={() =>
                  setForm((f) => ({ ...f, kind: 'break', visibility: 'private', minVersion: null }))
                }
              >
                <span className="choice__title">Romper</span>
                <span className="muted small">Hacerlo menos o nunca</span>
              </button>
            </div>
          )}
          <Input
            label={isBreak ? 'Hábito a dejar' : 'Hábito'}
            value={form.title ?? ''}
            maxLength={80}
            onChange={(e) => set('title', e.target.value)}
          />
          {!isBreak && (
            <Input
              label="Versión de 2 minutos"
              hint="Tan fácil que no puedas decir que no. También cuenta para tu racha."
              value={form.minVersion ?? ''}
              maxLength={120}
              onChange={(e) => set('minVersion', e.target.value)}
            />
          )}
        </section>
      )}

      {step === 2 && (
        <section className="stack">
          <h1>{isBreak ? '¿Cuándo aparece?' : '¿Cuándo y dónde?'}</h1>
          <p className="muted">
            {isBreak
              ? 'Te avisaremos a esa hora para elegir distinto.'
              : `“Haré ${form.title?.toLowerCase()} a las ${form.cueTime ?? '…'}${form.cuePlace ? ` en ${form.cuePlace}` : ''}.”`}
          </p>
          <Input
            label="Hora"
            type="time"
            value={form.cueTime ?? ''}
            onChange={(e) => set('cueTime', e.target.value || null)}
          />
          {!quick && (
            <>
              <Input
                label="Lugar"
                placeholder="la cama, el parque…"
                value={form.cuePlace ?? ''}
                onChange={(e) => set('cuePlace', e.target.value)}
              />
              {stackOptions.length > 0 && !isBreak && (
                <Select
                  label="Apilar después de (opcional)"
                  value={form.stackedOn ?? ''}
                  onChange={(e) => set('stackedOn', e.target.value || null)}
                >
                  <option value="">Sin apilar</option>
                  {stackOptions.map((h) => (
                    <option key={h.id} value={h.id}>
                      Después de: {h.title}
                    </option>
                  ))}
                </Select>
              )}
            </>
          )}
        </section>
      )}

      {step === 3 && !quick && (
        <section className="stack">
          <h1>¿Quién lo ve?</h1>
          <Select
            label="Visibilidad"
            value={form.visibility ?? 'pact'}
            onChange={(e) => set('visibility', e.target.value as CreateHabitInput['visibility'])}
          >
            <option value="pact">Mis pactos</option>
            <option value="friends">Mis amigos</option>
            <option value="private">Solo yo</option>
          </Select>
          {isBreak && (
            <>
              <Input
                label="¿Qué lo dispara?"
                hint="Separa con comas: aburrimiento, cansancio…"
                value={(form.triggers ?? []).join(', ')}
                onChange={(e) =>
                  set(
                    'triggers',
                    e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .slice(0, 10),
                  )
                }
              />
              <Input
                label="¿Qué harás en su lugar?"
                value={form.substitute ?? ''}
                onChange={(e) => set('substitute', e.target.value)}
              />
              <div className="row">
                <Input
                  label="Ganas por día"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={form.savingsPerDay ?? ''}
                  onChange={(e) =>
                    set('savingsPerDay', e.target.value ? Number(e.target.value) : null)
                  }
                />
                <Input
                  label="Unidad"
                  placeholder="h, COP…"
                  maxLength={12}
                  value={form.savingsUnit ?? ''}
                  onChange={(e) => set('savingsUnit', e.target.value || null)}
                />
              </div>
              <Checkbox
                label="Mi pacto puede ver mis tropiezos"
                description="Por defecto son privados."
                checked={form.relapseVisibility === 'pact'}
                onChange={(e) => set('relapseVisibility', e.target.checked ? 'pact' : 'private')}
              />
            </>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="small" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}

      {step > 0 && (
        <div className="row">
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            Atrás
          </Button>
          <Button size="lg" block loading={busy} onClick={next} disabled={!form.title}>
            {step + 1 >= steps ? 'Crear hábito' : 'Seguir'}
          </Button>
        </div>
      )}
    </div>
  );
}
