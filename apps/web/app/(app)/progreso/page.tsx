import { ACHIEVEMENTS, habit, me as meSchema, progressResponse, z } from '@habitos/contracts';
import { AchievementBadge, Card, HeatmapCalendar, type IconName, XpBar } from '@habitos/ui';
import type { Metadata } from 'next';
import { localToday } from '@/lib/dates';
import { identity } from '@/lib/identities';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Progreso' };

const ICONS: Record<string, IconName> = {
  seed: 'seed',
  sprout: 'sprout',
  tree: 'tree',
  mountain: 'mountain',
  sunrise: 'sunrise',
  feather: 'feather',
  hands: 'hands',
  heart: 'heart',
  star: 'star',
};

export default async function ProgressPage() {
  const next = '/progreso';
  const [progress, me, habits] = await Promise.all([
    serverApi('/me/progress', { schema: progressResponse, next }),
    serverApi('/me', { schema: meSchema, next }),
    serverApi('/habits', { schema: z.array(habit), next }),
  ]);
  const unlocked = new Set(progress.achievements.map((a) => a.code));
  const breaking = habits.filter((h) => h.kind === 'break');

  return (
    <>
      <header className="page-header">
        <span className="page-header__eyebrow">Tu progreso</span>
        <h1>
          {progress.identities[0]
            ? `${progress.identities[0].votes} votos por ${identity(progress.identities[0].identity).noun}`
            : 'Tu historia empieza hoy'}
        </h1>
      </header>

      {progress.identities.length > 0 && (
        <section className="section" aria-labelledby="identidades">
          <h2 id="identidades" className="section__title">
            Quién estás siendo
          </h2>
          <Card className="stack">
            {progress.identities.map((i) => (
              <XpBar
                key={i.identity}
                label={identity(i.identity).label}
                title={i.title}
                xp={i.xp}
                nextXp={i.nextLevelXp}
                progress={i.progress}
                votes={i.votes}
                color={identity(i.identity).color}
              />
            ))}
          </Card>
        </section>
      )}

      {breaking.length > 0 && (
        <section className="section" aria-labelledby="libertad">
          <h2 id="libertad" className="section__title">
            Contador de libertad
          </h2>
          {breaking.map((h) => (
            <Card key={h.id} tone="calm" className="page-header__row">
              <span>{h.title}</span>
              <strong style={{ fontSize: 'var(--font-size-xl)', whiteSpace: 'nowrap' }}>
                {h.freedom?.days ?? 0} días
                {h.freedom?.saved != null ? ` · ${h.freedom.saved} ${h.savingsUnit ?? ''}` : ''}
              </strong>
            </Card>
          ))}
        </section>
      )}

      <section className="section" aria-labelledby="mapa">
        <h2 id="mapa" className="section__title">
          Tus votos
        </h2>
        <HeatmapCalendar days={progress.heatmap} endDate={localToday(me.timezone)} />
      </section>

      <section className="section" aria-labelledby="misiones">
        <h2 id="misiones" className="section__title">
          Misiones de la semana
        </h2>
        <Card className="stack">
          {progress.missions.map((m) => (
            <div
              key={m.code}
              className="stack"
              style={{ '--stack-gap': 'var(--space-1)' } as React.CSSProperties}
            >
              <div className="page-header__row">
                <span className="small">{m.title}</span>
                <span className="small muted">
                  {m.progress}/{m.goal}
                </span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-label={m.title}
                aria-valuemin={0}
                aria-valuemax={m.goal}
                aria-valuenow={m.progress}
              >
                <span style={{ inlineSize: `${(m.progress / m.goal) * 100}%` }} />
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section className="section" aria-labelledby="logros">
        <h2 id="logros" className="section__title">
          Logros
        </h2>
        <div className="medals">
          {Object.entries(ACHIEVEMENTS).map(([code, a]) => (
            <AchievementBadge
              key={code}
              title={a.title}
              icon={ICONS[a.icon] ?? 'star'}
              unlocked={unlocked.has(code)}
            />
          ))}
        </div>
      </section>
    </>
  );
}
