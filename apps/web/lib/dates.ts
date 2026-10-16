/** Fecha local (AAAA-MM-DD) en la zona del usuario, igual que la calcula la API. */
export function localToday(tz: string, at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

export function timeAgo(iso: string, now = Date.now()) {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return 'ahora';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86_400), 'day');
}

export function greeting(tz: string, at = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(
      at,
    ),
  );
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
}
