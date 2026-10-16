import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { and, eq } from 'drizzle-orm';
import { addDays, localToday, zonedToUtc } from '../src/common/time';
import type { Db } from '../src/db/client';
import { DB } from '../src/db/db.module';
import { habitLogs, habits, jobs, streaks, users } from '../src/db/schema';
import { WorkerService } from '../src/jobs/worker.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PushService } from '../src/modules/notifications/push.service';
import { getApp, newUser, startApp, stopApp } from './helpers';

let base: string;
let pushed: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
let gone = new Set<string>();

before(async () => {
  base = await startApp();
  getApp()
    .get(PushService)
    .useSender(async (sub, payload) => {
      if (gone.has(sub.endpoint)) throw Object.assign(new Error('gone'), { statusCode: 410 });
      pushed.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
      return { statusCode: 201 };
    });
});
after(stopApp);
beforeEach(() => {
  pushed = [];
  gone = new Set();
});

const db = () => getApp().get<Db>(DB);

async function subscribed(overrides: Record<string, unknown> = {}) {
  const u = await newUser(base, overrides);
  const endpoint = `https://push.example.com/${randomUUID()}`;
  const res = await u.client.post('/push/subscribe', {
    endpoint,
    keys: { p256dh: 'clave-p256dh', auth: 'clave-auth' },
  });
  assert.equal(res.status, 200);
  return { ...u, endpoint };
}

describe('recordatorios programados', () => {
  it('llega a la hora local configurada con acciones rápidas y se reprograma', async () => {
    const { client, endpoint } = await subscribed({ timezone: 'Europe/Madrid' });
    const habit = (
      await client.post('/habits', {
        kind: 'build',
        identity: 'calm',
        title: 'Meditar',
        minVersion: 'Respirar 3 veces',
        cueTime: '07:30',
      })
    ).body;

    const [job] = await db()
      .select()
      .from(jobs)
      .where(eq(jobs.uniqueKey, `reminder:${habit.id}`));
    assert.ok(job);
    // 07:30 en Madrid, sea horario de verano o no.
    const local = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit',
    }).format(job.runAt);
    assert.equal(local, '07:30');

    const at = new Date(job.runAt.getTime() + 1000);
    await getApp().get(WorkerService).runDueJobs(at);
    const push = pushed.find((p) => p.endpoint === endpoint);
    assert.ok(push, 'el recordatorio debe enviarse');
    assert.equal(push.payload.title, 'Meditar');
    assert.match(String(push.payload.body), /Respirar 3 veces/);
    assert.deepEqual(
      (push.payload.actions as Array<{ action: string }>).map((a) => a.action),
      ['done', 'min'],
    );

    const [next] = await db()
      .select()
      .from(jobs)
      .where(eq(jobs.uniqueKey, `reminder:${habit.id}`));
    assert.ok(next);
    assert.equal(Math.round((next.runAt.getTime() - job.runAt.getTime()) / 3_600_000), 24);
  });

  it('si ya registró el hábito, el recordatorio se omite', async () => {
    const { client, endpoint } = await subscribed();
    const habit = (
      await client.post('/habits', {
        kind: 'build',
        identity: 'reader',
        title: 'Leer',
        cueTime: '23:59',
      })
    ).body;
    await client.post(`/habits/${habit.id}/logs`, { status: 'done', clientId: randomUUID() });
    const [job] = await db()
      .select()
      .from(jobs)
      .where(eq(jobs.uniqueKey, `reminder:${habit.id}`));
    // Se ejecuta "ahora", dentro del mismo día local en que ya registró.
    await db()
      .update(jobs)
      .set({ runAt: new Date(Date.now() - 1000) })
      .where(eq(jobs.id, job!.id));
    await getApp().get(WorkerService).runDueJobs(new Date());
    assert.equal(pushed.filter((p) => p.endpoint === endpoint).length, 0);
  });

  it('borra las suscripciones que responden 410', async () => {
    const { user, endpoint } = await subscribed();
    gone.add(endpoint);
    const delivered = await getApp().get(PushService).send(user.id, { title: 'x', body: 'y' });
    assert.equal(delivered, 0);
    assert.equal(await getApp().get(PushService).send(user.id, { title: 'x', body: 'y' }), 0);
  });
});

describe('reglas para no saturar', () => {
  it('máximo 4 push al día y nada en horario silencioso', async () => {
    const { user, client } = await subscribed();
    await client.patch('/me', { quietStart: '00:00', quietEnd: '00:00' });
    const service = getApp().get(NotificationsService);
    for (let i = 0; i < 6; i++) {
      await service.notify(user.id, 'nudge', { title: `n${i}`, body: 'b' });
    }
    assert.equal(pushed.length, 4);

    const other = await subscribed();
    // 23:00 en Bogotá está dentro del silencio por defecto (22:00 a 07:00).
    const night = zonedToUtc(localToday('America/Bogota'), '23:00', 'America/Bogota');
    const res = await service.notify(other.user.id, 'nudge', { title: 'noche', body: 'b' }, night);
    assert.equal(res.pushed, false);
    assert.equal(res.inApp, true);
  });

  it('respeta las preferencias por tipo', async () => {
    const { user, client } = await subscribed();
    await client.patch('/me', { notificationPrefs: { nudge: false } });
    const res = await getApp()
      .get(NotificationsService)
      .notify(user.id, 'nudge', { title: 't', body: 'b' });
    assert.deepEqual(res, { inApp: false, pushed: false });
  });
});

describe('bandeja in-app en tiempo real (SSE)', () => {
  it('envía el contador inicial y las notificaciones nuevas al instante', async () => {
    const { client, user } = await newUser(base);
    const cookie = [...client.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const controller = new AbortController();
    const res = await fetch(`${base}/notifications/stream`, {
      headers: { cookie },
      signal: controller.signal,
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const readUntil = async (needle: string) => {
      while (!buffer.includes(needle)) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
      }
      return buffer;
    };

    await readUntil('event: unread');
    await getApp()
      .get(NotificationsService)
      .notify(user.id, 'achievement', { title: 'Logro de prueba', body: 'b' });
    const text = await readUntil('Logro de prueba');
    assert.match(text, /event: notification/);
    controller.abort();

    const inbox = await client.get('/notifications');
    assert.equal(inbox.body.unread, 1);
    const read = await client.post('/notifications/read', {});
    assert.equal(read.body.unread, 0);
  });

  it('el stream exige sesión', async () => {
    const res = await fetch(`${base}/notifications/stream`);
    assert.equal(res.status, 401);
  });
});

describe('cierre diario', () => {
  it('consume un comodín automático para no romper la racha y renueva los lunes', async () => {
    const { client, user } = await newUser(base);
    const habit = (
      await client.post('/habits', { kind: 'build', identity: 'athlete', title: 'Correr' })
    ).body;
    const tz = 'America/Bogota';
    const today = localToday(tz);
    await db()
      .update(habits)
      .set({ startDate: addDays(today, -6) })
      .where(eq(habits.id, habit.id));
    for (const d of [4, 3]) {
      await client.post(`/habits/${habit.id}/logs`, {
        status: 'done',
        localDate: addDays(today, -d),
        clientId: randomUUID(),
      });
    }
    // Ayer y anteayer sin registro: el primer hueco usa un comodín, el segundo otro.
    await db()
      .update(users)
      .set({ lastClosedDate: addDays(today, -4) })
      .where(eq(users.id, user.id));
    const [row] = await db().select().from(users).where(eq(users.id, user.id));
    await getApp().get(WorkerService).closeDays(row!, new Date());

    const skips = await db()
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habit.id), eq(habitLogs.status, 'skip')));
    assert.equal(skips.length, 2);
    const [s] = await db().select().from(streaks).where(eq(streaks.habitId, habit.id));
    assert.equal(s!.current, 2);
    const [after] = await db().select().from(users).where(eq(users.id, user.id));
    assert.equal(after!.lastClosedDate, addDays(today, -1));
  });

  it('sin racha viva no gasta comodines', async () => {
    const { client, user } = await newUser(base);
    const habit = (
      await client.post('/habits', { kind: 'build', identity: 'athlete', title: 'Correr' })
    ).body;
    const today = localToday('America/Bogota');
    await db()
      .update(habits)
      .set({ startDate: addDays(today, -6) })
      .where(eq(habits.id, habit.id));
    await db()
      .update(users)
      .set({ lastClosedDate: addDays(today, -4) })
      .where(eq(users.id, user.id));
    const [row] = await db().select().from(users).where(eq(users.id, user.id));
    await getApp().get(WorkerService).closeDays(row!, new Date());
    const skips = await db()
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habit.id), eq(habitLogs.status, 'skip')));
    assert.equal(skips.length, 0);
    const [s] = await db().select().from(streaks).where(eq(streaks.habitId, habit.id));
    assert.equal(s!.freezesLeft, 2);
  });

  it('avisa del riesgo de racha antes del horario silencioso, una vez al día', async () => {
    const { client, user, endpoint } = await subscribed();
    const habit = (
      await client.post('/habits', {
        kind: 'build',
        identity: 'reader',
        title: 'Leer',
        minVersion: 'Una página',
      })
    ).body;
    const tz = 'America/Bogota';
    const today = localToday(tz);
    await db()
      .update(habits)
      .set({ startDate: addDays(today, -3) })
      .where(eq(habits.id, habit.id));
    await client.post(`/habits/${habit.id}/logs`, {
      status: 'done',
      localDate: addDays(today, -1),
      clientId: randomUUID(),
    });

    const worker = getApp().get(WorkerService);
    const at = zonedToUtc(today, '20:30', tz);
    const [row] = await db().select().from(users).where(eq(users.id, user.id));
    await worker.streakRisk(row!, at);
    const [row2] = await db().select().from(users).where(eq(users.id, user.id));
    await worker.streakRisk(row2!, at);
    const risk = pushed.filter((p) => p.endpoint === endpoint);
    assert.equal(risk.length, 1);
    assert.match(String(risk[0]!.payload.title), /racha de 1 día te espera/);
  });
});
