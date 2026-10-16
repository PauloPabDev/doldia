/** Utilidades de fecha por zona horaria, solo con Intl (sin librerías). */

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    partsCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  date: string;
  hour: number;
  minute: number;
  /** 0 = domingo … 6 = sábado */
  weekday: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function zonedParts(at: Date, tz: string): ZonedParts {
  const p = Object.fromEntries(
    formatter(tz)
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WEEKDAYS.indexOf(p.weekday ?? 'Sun'),
  };
}

export function localToday(tz: string, now = new Date()): string {
  return zonedParts(now, tz).date;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

/** Desfase de la zona (ms) en un instante dado. */
function offsetMs(at: Date, tz: string): number {
  const p = Object.fromEntries(
    formatter(tz)
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Convierte una fecha y hora local de `tz` a un instante UTC. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const guess = new Date(`${date}T${time}:00Z`);
  const first = new Date(guess.getTime() - offsetMs(guess, tz));
  // Segunda pasada para los cambios de horario.
  return new Date(guess.getTime() - offsetMs(first, tz));
}

/** Próximo instante en que el reloj local marca `time` (HH:MM), estrictamente después de `now`. */
export function nextOccurrence(time: string, tz: string, now = new Date()): Date {
  const today = localToday(tz, now);
  const candidate = zonedToUtc(today, time, tz);
  return candidate.getTime() > now.getTime() ? candidate : zonedToUtc(addDays(today, 1), time, tz);
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** ¿La hora local cae en el horario silencioso? Soporta rangos que cruzan medianoche. */
export function inQuietHours(parts: ZonedParts, quietStart: string, quietEnd: string): boolean {
  const now = parts.hour * 60 + parts.minute;
  const start = minutesOf(quietStart);
  const end = minutesOf(quietEnd);
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}
