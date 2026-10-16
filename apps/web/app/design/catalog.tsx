'use client';

import { NUDGE_MESSAGES, REACTIONS } from '@habitos/contracts';
import {
  AchievementBadge,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  CheckInButton,
  type CheckInState,
  EmptyState,
  Garden,
  HabitCard,
  HeatmapCalendar,
  Icon,
  Input,
  NudgeButton,
  PactFeedItem,
  ReactionBar,
  Select,
  Sheet,
  Skeleton,
  StreakFlame,
  Textarea,
  useToast,
  XpBar,
} from '@habitos/ui';
import { useState } from 'react';

const today = new Date().toISOString().slice(0, 10);
const heat = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
  return { date: d, count: (i * 7) % 5 === 0 ? 0 : ((i * 3) % 3) + 1 };
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h2 className="section__title">{title}</h2>
      <Card className="stack">{children}</Card>
    </section>
  );
}

export function Catalog() {
  const { show } = useToast();
  const [state, setState] = useState<CheckInState>('pending');
  const [sheet, setSheet] = useState(false);
  const [reactions, setReactions] = useState([{ emoji: '🔥', count: 2, mine: false }]);

  const toggleTheme = () => {
    const el = document.documentElement;
    el.dataset.theme = el.dataset.theme === 'dark' ? 'light' : 'dark';
  };
  const toggleCalm = () => {
    const el = document.documentElement;
    if (el.dataset.mode) delete el.dataset.mode;
    else el.dataset.mode = 'calm';
  };

  return (
    <main className="page" style={{ paddingBottom: 'var(--space-12)' }}>
      <header className="page-header">
        <span className="page-header__eyebrow">packages/ui + packages/tokens</span>
        <h1>Design system</h1>
        <div className="row">
          <Button variant="secondary" onClick={toggleTheme}>
            Claro / oscuro
          </Button>
          <Button variant="ghost" onClick={toggleCalm}>
            Modo calma
          </Button>
        </div>
      </header>

      <Section title="Botones">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Button>Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="social">Social</Button>
          <Button variant="danger">Destructivo</Button>
          <Button loading>Cargando</Button>
          <Button disabled>Deshabilitado</Button>
        </div>
        <Button size="lg" block icon={<Icon name="check" />}>
          Grande y ancho
        </Button>
      </Section>

      <Section title="Formularios">
        <Input label="Nombre" placeholder="Ana" hint="Así te verá tu pacto" />
        <Input label="Correo" error="Correo no válido" defaultValue="ana@" />
        <Select label="Visibilidad" defaultValue="pact">
          <option value="pact">Mis pactos</option>
          <option value="private">Solo yo</option>
        </Select>
        <Textarea label="Nota" placeholder="¿Cómo te fue?" />
        <Checkbox
          label="Mi pacto puede ver mis tropiezos"
          description="Por defecto son privados."
        />
      </Section>

      <Section title="Avatares e insignias">
        <div className="row">
          <Avatar name="Ana Ruiz" size="sm" />
          <Avatar name="Beto" />
          <Avatar name="Carla Gómez" size="lg" lit />
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Badge>Neutro</Badge>
          <Badge tone="accent">Lector</Badge>
          <Badge tone="celebrate">Nivel 3</Badge>
          <Badge tone="social">Pacto</Badge>
          <Badge tone="calm">Libre</Badge>
        </div>
      </Section>

      <Section title="Registro">
        <div className="row" style={{ gap: 'var(--space-4)' }}>
          {(['pending', 'done', 'min', 'skip', 'relapse'] as CheckInState[]).map((s) => (
            <CheckInButton key={s} state={s} label={`Estado ${s}`} onCheckIn={() => undefined} />
          ))}
        </div>
        <div className="row">
          <CheckInButton
            state={state}
            label="Prueba"
            onCheckIn={() => setState(state === 'pending' ? 'done' : 'pending')}
          />
          <span className="small muted">Toca para ver la animación</span>
        </div>
      </Section>

      <Section title="Rachas">
        <div className="row" style={{ gap: 'var(--space-4)' }}>
          <StreakFlame count={0} />
          <StreakFlame count={3} />
          <StreakFlame count={7} />
          <StreakFlame count={21} />
          <StreakFlame count={30} />
          <StreakFlame count={12} shielded />
        </div>
      </Section>

      <Section title="Tarjetas de hábito">
        <ul className="list">
          <HabitCard
            id="a"
            title="Leer 10 páginas"
            kind="build"
            identityLabel="Lector"
            identityColor="#5B7FA6"
            state={state}
            streak={8}
            minVersion="Leer 1 página"
            cue="21:30 en la cama"
            onCheckIn={() => setState('done')}
            onOptions={() => setSheet(true)}
          />
          <HabitCard
            id="b"
            title="Correr"
            kind="build"
            identityLabel="Atleta"
            identityColor="#E8735A"
            state="min"
            streak={21}
            onCheckIn={() => undefined}
          />
          <HabitCard
            id="c"
            title="Redes de noche"
            kind="break"
            identityLabel="Libre"
            identityColor="#5B7FA6"
            state="pending"
            streak={0}
            freedomDays={12}
            freedomSaved="18 h"
            onCheckIn={() => undefined}
          />
        </ul>
      </Section>

      <Section title="Mapa de calor">
        <HeatmapCalendar days={heat} endDate={today} />
      </Section>

      <Section title="Progreso y logros">
        <XpBar
          label="Lector"
          title="Lector · Constante"
          xp={210}
          nextXp={350}
          progress={0.3}
          votes={21}
          color="#5B7FA6"
        />
        <div className="medals">
          <AchievementBadge title="Primer voto" icon="seed" unlocked />
          <AchievementBadge title="21 días" icon="tree" unlocked={false} />
          <AchievementBadge title="En equipo" icon="hands" unlocked />
        </div>
      </Section>

      <Section title="Pacto">
        <Garden growth={0.45} members={4} />
        <Garden growth={1} members={3} />
        <ul className="list" style={{ gap: 0 }}>
          <PactFeedItem
            name="Beto"
            habitTitle="Correr"
            status="done"
            kind="build"
            when="hace 5 minutos"
            note="¡Con lluvia y todo!"
          >
            <ReactionBar
              reactions={reactions}
              options={REACTIONS}
              onToggle={(emoji, mine) =>
                setReactions((r) => {
                  const ex = r.find((x) => x.emoji === emoji);
                  if (mine)
                    return r
                      .map((x) =>
                        x.emoji === emoji ? { ...x, count: x.count - 1, mine: false } : x,
                      )
                      .filter((x) => x.count);
                  if (ex)
                    return r.map((x) =>
                      x.emoji === emoji ? { ...x, count: x.count + 1, mine: true } : x,
                    );
                  return [...r, { emoji, count: 1, mine: true }];
                })
              }
            />
          </PactFeedItem>
          <PactFeedItem
            name="Carla"
            habitTitle="Meditar"
            status="min"
            kind="build"
            when="hace 1 hora"
          />
        </ul>
        <NudgeButton name="Carla" messages={NUDGE_MESSAGES} onNudge={() => undefined} />
      </Section>

      <Section title="Paneles, avisos y estados">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Abrir panel
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              show({ message: 'Un voto más por ser lector', tone: 'celebrate', accent: '+10 XP' })
            }
          >
            Toast
          </Button>
        </div>
        <Skeleton lines={2} height={56} />
        <EmptyState
          icon="hands"
          title="Crea tu primer pacto"
          body="Un hábito se sostiene mejor en grupo."
          action={<Button>Crear pacto</Button>}
        />
      </Section>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Leer 10 páginas">
        <div className="stack">
          <Button size="lg" block onClick={() => setSheet(false)}>
            Hecho
          </Button>
          <Button size="lg" variant="secondary" block onClick={() => setSheet(false)}>
            Versión de 2 min: Leer 1 página
          </Button>
        </div>
      </Sheet>
    </main>
  );
}
