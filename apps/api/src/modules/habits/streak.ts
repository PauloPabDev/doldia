import type { LogStatus } from '@habitos/contracts';
import { addDays, diffDays } from '../../common/time';

export interface DayLog {
  localDate: string;
  status: LogStatus;
}

const COUNTS = new Set<LogStatus>(['done', 'min']);
/** Un comodín protege el día: no suma, pero tampoco rompe la racha. */
const KEEPS = new Set<LogStatus>(['done', 'min', 'skip']);

/**
 * Racha de un hábito a construir. El día de hoy sigue abierto: si aún no hay
 * registro, la racha se cuenta hasta ayer y no se pierde antes de medianoche.
 */
export function buildStreak(logs: DayLog[], today: string) {
  const byDate = new Map(logs.map((l) => [l.localDate, l.status]));

  let current = 0;
  let day = byDate.has(today) ? today : addDays(today, -1);
  for (;;) {
    const status = byDate.get(day);
    if (!status || !KEEPS.has(status)) break;
    if (COUNTS.has(status)) current++;
    day = addDays(day, -1);
  }

  let best = 0;
  let run = 0;
  let prev: string | undefined;
  for (const log of [...logs].sort((a, b) => a.localDate.localeCompare(b.localDate))) {
    if (!KEEPS.has(log.status)) {
      run = 0;
      prev = undefined;
      continue;
    }
    if (prev && diffDays(log.localDate, prev) !== 1) run = 0;
    if (COUNTS.has(log.status)) run++;
    best = Math.max(best, run);
    prev = log.localDate;
  }

  const lastDate =
    logs
      .filter((l) => COUNTS.has(l.status))
      .map((l) => l.localDate)
      .sort()
      .at(-1) ?? null;

  return { current, best: Math.max(best, current), lastDate };
}

/** Contador de libertad para un hábito a romper: días completos desde la última recaída. */
export function freedomStreak(logs: DayLog[], today: string, startDate: string) {
  const relapses = logs
    .filter((l) => l.status === 'relapse')
    .map((l) => l.localDate)
    .sort();
  const lastRelapse = relapses.at(-1);
  const from = lastRelapse ? addDays(lastRelapse, 1) : startDate;
  const current = Math.max(0, diffDays(today, from));

  // Mejor tramo histórico entre recaídas.
  let best = current;
  let cursor = startDate;
  for (const r of relapses) {
    best = Math.max(best, diffDays(r, cursor));
    cursor = addDays(r, 1);
  }
  return { current, best, lastDate: lastRelapse ?? null };
}

/** ¿Faltó ayer pero hubo registro antes de ayer? Es el "volviste" de nunca fallar dos veces. */
export function isComeback(logs: DayLog[], today: string) {
  const byDate = new Map(logs.map((l) => [l.localDate, l.status]));
  const yesterday = byDate.get(addDays(today, -1));
  const before = byDate.get(addDays(today, -2));
  return !yesterday && !!before && COUNTS.has(before);
}
