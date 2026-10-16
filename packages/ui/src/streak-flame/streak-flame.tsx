import { cx } from '../cx';

export interface StreakFlameProps {
  count: number;
  /** Día protegido por comodín: se muestra con escudo. */
  shielded?: boolean;
  unit?: string;
  className?: string;
}

/** Hitos en los que la llama crece: 7, 21 y 30 días. */
export function milestone(count: number) {
  return count >= 30 ? 3 : count >= 21 ? 2 : count >= 7 ? 1 : 0;
}

export function StreakFlame({ count, shielded, unit = 'días', className }: StreakFlameProps) {
  const level = milestone(count);
  return (
    <span
      className={cx('hb-flame', `hb-flame--m${level}`, count === 0 && 'hb-flame--cold', className)}
      aria-label={`Racha de ${count} ${count === 1 ? unit.replace(/s$/, '') : unit}${shielded ? ', protegida con comodín' : ''}`}
      role="img"
    >
      <svg viewBox="0 0 24 24" className="hb-flame__icon" aria-hidden="true">
        {shielded ? (
          <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />
        ) : (
          <path d="M12 22c4 0 7-2.8 7-6.8 0-3.7-2.4-6-4.3-8.2-.4 2.2-1.6 3.5-2.9 3.5.6-3.3-.6-6.3-3.3-8.5.2 3.6-3.5 6.4-3.5 11.2C5 19.2 8 22 12 22z" />
        )}
      </svg>
      <span className="hb-flame__count">{count}</span>
    </span>
  );
}
