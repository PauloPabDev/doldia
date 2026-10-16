'use client';

import { useMemo, useState } from 'react';
import { cx } from '../cx';

export interface HeatmapCalendarProps {
  days: Array<{ date: string; count: number }>;
  endDate: string;
  weeks?: number;
  label?: string;
}

const DAY_MS = 86_400_000;
const fmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Mapa de calor: el color no es la única señal; los días intensos llevan patrón y al tocar se ve el número. */
export function HeatmapCalendar({
  days,
  endDate,
  weeks = 17,
  label = 'Registros por día',
}: HeatmapCalendarProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const counts = useMemo(() => new Map(days.map((d) => [d.date, d.count])), [days]);

  const cells = useMemo(() => {
    const end = new Date(`${endDate}T00:00:00Z`);
    // Empieza en lunes para que cada columna sea una semana.
    const endDow = (end.getUTCDay() + 6) % 7;
    const start = new Date(end.getTime() - ((weeks - 1) * 7 + endDow) * DAY_MS);
    const out: Array<{ date: string; count: number; future: boolean }> = [];
    for (let t = start.getTime(); out.length < weeks * 7; t += DAY_MS) {
      const date = iso(new Date(t));
      out.push({ date, count: counts.get(date) ?? 0, future: date > endDate });
    }
    return out;
  }, [counts, endDate, weeks]);

  const max = Math.max(1, ...days.map((d) => d.count));
  const level = (c: number) => (c === 0 ? 0 : c >= max ? 3 : c / max > 0.5 ? 2 : 1);
  const sel = selected ? { date: selected, count: counts.get(selected) ?? 0 } : null;
  const total = days.reduce((a, d) => a + d.count, 0);

  return (
    <figure className="hb-heatmap">
      <div className="hb-heatmap__grid" role="group" aria-label={`${label}: ${total} en total`}>
        {cells.map((c) => (
          <button
            key={c.date}
            type="button"
            disabled={c.future}
            className={cx(
              'hb-heatmap__cell',
              `hb-heatmap__cell--l${level(c.count)}`,
              selected === c.date && 'hb-heatmap__cell--selected',
            )}
            aria-label={`${fmt.format(new Date(`${c.date}T00:00:00Z`))}: ${c.count} ${c.count === 1 ? 'registro' : 'registros'}`}
            onClick={() => setSelected(c.date === selected ? null : c.date)}
          />
        ))}
      </div>
      <figcaption className="hb-heatmap__caption" aria-live="polite">
        {sel
          ? `${fmt.format(new Date(`${sel.date}T00:00:00Z`))}: ${sel.count} ${sel.count === 1 ? 'voto' : 'votos'}`
          : `${total} votos en las últimas ${weeks} semanas`}
      </figcaption>
    </figure>
  );
}
