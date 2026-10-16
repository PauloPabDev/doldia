export interface XpBarProps {
  label: string;
  title: string;
  xp: number;
  nextXp: number | null;
  /** 0 a 1 dentro del nivel actual. */
  progress: number;
  votes: number;
  color?: string;
}

export function XpBar({ label, title, xp, nextXp, progress, votes, color }: XpBarProps) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div
      className="hb-xp"
      style={color ? ({ '--xp-color': color } as React.CSSProperties) : undefined}
    >
      <div className="hb-xp__head">
        <span className="hb-xp__title">{title}</span>
        <span className="hb-xp__votes">
          {votes} {votes === 1 ? 'voto' : 'votos'}
        </span>
      </div>
      <div
        className="hb-xp__track"
        role="progressbar"
        aria-label={`Progreso de ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={nextXp ? `${xp} de ${nextXp} XP` : `${xp} XP, nivel máximo`}
      >
        <span className="hb-xp__fill" style={{ inlineSize: `${pct}%` }} />
      </div>
      <span className="hb-xp__numbers">{nextXp ? `${xp} / ${nextXp} XP` : `${xp} XP`}</span>
    </div>
  );
}
