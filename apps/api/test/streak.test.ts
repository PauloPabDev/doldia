import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LogStatus } from '@habitos/contracts';
import {
  addDays,
  inQuietHours,
  localToday,
  nextOccurrence,
  zonedParts,
  zonedToUtc,
} from '../src/common/time';
import { buildStreak, freedomStreak, isComeback } from '../src/modules/habits/streak';

const today = '2026-10-15';
const log = (offset: number, status: LogStatus = 'done') => ({
  localDate: addDays(today, -offset),
  status,
});

describe('racha de hábitos a construir', () => {
  it('cuenta días consecutivos, incluida la versión de 2 minutos', () => {
    const s = buildStreak([log(0), log(1, 'min'), log(2), log(4)], today);
    assert.equal(s.current, 3);
    assert.equal(s.best, 3);
    assert.equal(s.lastDate, today);
  });

  it('hoy sigue abierto: sin registro hoy la racha llega hasta ayer', () => {
    assert.equal(buildStreak([log(1), log(2)], today).current, 2);
  });

  it('un comodín protege el día sin sumar', () => {
    const s = buildStreak([log(0), log(1, 'skip'), log(2), log(3)], today);
    assert.equal(s.current, 3);
  });

  it('un hueco rompe la racha pero conserva el récord', () => {
    const s = buildStreak([log(0), log(2), log(3), log(4), log(5)], today);
    assert.equal(s.current, 1);
    assert.equal(s.best, 4);
  });

  it('sin registros todo es cero', () => {
    assert.deepEqual(buildStreak([], today), { current: 0, best: 0, lastDate: null });
  });

  it('detecta el regreso tras fallar un día', () => {
    assert.equal(isComeback([log(2)], today), true);
    assert.equal(isComeback([log(1)], today), false);
    assert.equal(isComeback([], today), false);
  });
});

describe('contador de libertad', () => {
  it('cuenta días desde el inicio', () => {
    assert.equal(freedomStreak([], today, addDays(today, -10)).current, 10);
  });

  it('una recaída reinicia el contador y guarda el mejor tramo', () => {
    const s = freedomStreak([log(3, 'relapse')], today, addDays(today, -20));
    assert.equal(s.current, 2);
    assert.equal(s.best, 17);
  });

  it('recaer hoy deja el contador en cero', () => {
    assert.equal(freedomStreak([log(0, 'relapse')], today, addDays(today, -5)).current, 0);
  });
});

describe('zonas horarias', () => {
  it('la fecha local depende de la zona del usuario', () => {
    const at = new Date('2026-10-16T03:30:00Z');
    assert.equal(localToday('America/Bogota', at), '2026-10-15');
    assert.equal(localToday('Europe/Madrid', at), '2026-10-16');
  });

  it('convierte hora local a UTC, incluso con horario de verano', () => {
    assert.equal(
      zonedToUtc('2026-10-15', '07:00', 'America/Bogota').toISOString(),
      '2026-10-15T12:00:00.000Z',
    );
    assert.equal(
      zonedToUtc('2026-07-01', '07:00', 'Europe/Madrid').toISOString(),
      '2026-07-01T05:00:00.000Z',
    );
    assert.equal(
      zonedToUtc('2026-12-01', '07:00', 'Europe/Madrid').toISOString(),
      '2026-12-01T06:00:00.000Z',
    );
  });

  it('el próximo recordatorio es hoy si aún no pasó la hora, si no mañana', () => {
    const now = new Date('2026-10-15T12:30:00Z'); // 07:30 en Bogotá
    assert.equal(
      nextOccurrence('08:00', 'America/Bogota', now).toISOString(),
      '2026-10-15T13:00:00.000Z',
    );
    assert.equal(
      nextOccurrence('07:00', 'America/Bogota', now).toISOString(),
      '2026-10-16T12:00:00.000Z',
    );
  });

  it('horario silencioso que cruza medianoche', () => {
    const at = (h: number) => ({ ...zonedParts(new Date(), 'UTC'), hour: h, minute: 0 });
    assert.equal(inQuietHours(at(23), '22:00', '07:00'), true);
    assert.equal(inQuietHours(at(3), '22:00', '07:00'), true);
    assert.equal(inQuietHours(at(12), '22:00', '07:00'), false);
    assert.equal(inQuietHours(at(13), '12:00', '14:00'), true);
  });
});
