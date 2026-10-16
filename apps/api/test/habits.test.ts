import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { eq } from 'drizzle-orm';
import { addDays, localToday } from '../src/common/time';
import type { Db } from '../src/db/client';
import { DB } from '../src/db/db.module';
import { habits, jobs } from '../src/db/schema';
import { getApp, newUser, startApp, stopApp } from './helpers';

let base: string;
before(async () => {
  base = await startApp();
});
after(stopApp);

const reading = {
  kind: 'build',
  identity: 'reader',
  title: 'Leer 10 páginas',
  minVersion: 'Leer 1 página',
  cueTime: '21:00',
  cuePlace: 'la cama',
};

describe('hábitos', () => {
  it('crea un hábito con identidad, versión mínima y recordatorio agendado', async () => {
    const { client } = await newUser(base);
    const res = await client.post('/habits', reading);
    assert.equal(res.status, 201);
    assert.equal(res.body.identity, 'reader');
    assert.equal(res.body.minVersion, 'Leer 1 página');
    assert.equal(res.body.streak.current, 0);
    assert.equal(res.body.streak.freezesLeft, 2);
    assert.equal(res.body.visibility, 'pact');
    assert.equal(res.body.relapseVisibility, 'private');

    const db = getApp().get<Db>(DB);
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.uniqueKey, `reminder:${res.body.id}`));
    assert.ok(job, 'debe existir el trabajo de recordatorio');
    assert.ok(job.runAt.getTime() > Date.now());
  });

  it('valida la entrada', async () => {
    const { client } = await newUser(base);
    const res = await client.post('/habits', { ...reading, identity: 'pirata', cueTime: '25:00' });
    assert.equal(res.status, 400);
  });

  it('no deja ver ni tocar hábitos ajenos (404)', async () => {
    const a = await newUser(base);
    const b = await newUser(base);
    const habit = (await a.client.post('/habits', reading)).body;
    assert.equal((await b.client.get(`/habits/${habit.id}`)).status, 404);
    assert.equal((await b.client.patch(`/habits/${habit.id}`, { title: 'x' })).status, 404);
    const log = await b.client.post(`/habits/${habit.id}/logs`, {
      status: 'done',
      clientId: randomUUID(),
    });
    assert.equal(log.status, 404);
  });

  it('apila un hábito sobre otro propio, no sobre uno ajeno', async () => {
    const a = await newUser(base);
    const b = await newUser(base);
    const coffee = (await a.client.post('/habits', { ...reading, title: 'Café', cueTime: null }))
      .body;
    const foreign = (await b.client.post('/habits', reading)).body;
    const ok = await a.client.post('/habits', {
      ...reading,
      title: 'Meditar',
      stackedOn: coffee.id,
    });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.stackedOn, coffee.id);
    const bad = await a.client.post('/habits', { ...reading, stackedOn: foreign.id });
    assert.equal(bad.status, 404);
  });
});

describe('registro', () => {
  it('registra en un toque, sube la racha y da XP con primer logro', async () => {
    const { client } = await newUser(base);
    const habit = (await client.post('/habits', reading)).body;
    const res = await client.post(`/habits/${habit.id}/logs`, {
      status: 'done',
      clientId: randomUUID(),
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.streak.current, 1);
    assert.equal(res.body.reward.xp, 30); // 10 por registro + 20 del primer voto
    assert.deepEqual(
      res.body.reward.achievements.map((a: { code: string }) => a.code),
      ['first_vote'],
    );

    const today = await client.get('/today');
    assert.equal(today.body.votesToday, 1);
    assert.equal(today.body.habits[0].today.status, 'done');
  });

  it('el mismo client_id no duplica (cola offline)', async () => {
    const { client } = await newUser(base);
    const habit = (await client.post('/habits', reading)).body;
    const clientId = randomUUID();
    const a = await client.post(`/habits/${habit.id}/logs`, { status: 'min', clientId });
    const b = await client.post(`/habits/${habit.id}/logs`, { status: 'min', clientId });
    assert.equal(a.body.duplicate, false);
    assert.equal(b.body.duplicate, true);
    assert.equal(b.body.reward.xp, 0);
    assert.equal(a.body.log.id, b.body.log.id);
  });

  it('de 2 minutos a completo suma XP, otro estado el mismo día es conflicto', async () => {
    const { client } = await newUser(base);
    const habit = (await client.post('/habits', reading)).body;
    await client.post(`/habits/${habit.id}/logs`, { status: 'min', clientId: randomUUID() });
    const up = await client.post(`/habits/${habit.id}/logs`, {
      status: 'done',
      clientId: randomUUID(),
    });
    assert.equal(up.status, 201);
    assert.equal(up.body.log.status, 'done');
    const skip = await client.post(`/habits/${habit.id}/logs`, {
      status: 'skip',
      clientId: randomUUID(),
    });
    assert.equal(skip.status, 409);
  });

  it('deshacer un toque accidental devuelve la racha', async () => {
    const { client } = await newUser(base);
    const habit = (await client.post('/habits', reading)).body;
    const log = await client.post(`/habits/${habit.id}/logs`, {
      status: 'done',
      clientId: randomUUID(),
    });
    const res = await client.del(`/habits/${habit.id}/logs/${log.body.log.localDate}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.streak.current, 0);
  });

  it('el comodín protege un día y se agota', async () => {
    const { client, user } = await newUser(base);
    const habit = (await client.post('/habits', reading)).body;
    // El hábito "existe" desde hace 5 días para poder registrar atrás.
    const db = getApp().get<Db>(DB);
    const today = localToday('America/Bogota');
    await db
      .update(habits)
      .set({ startDate: addDays(today, -5) })
      .where(eq(habits.id, habit.id));
    void user;

    const log = (status: string, daysAgo: number) =>
      client.post(`/habits/${habit.id}/logs`, {
        status,
        localDate: addDays(today, -daysAgo),
        clientId: randomUUID(),
      });
    await log('done', 4);
    await log('skip', 3);
    await log('skip', 2);
    const third = await log('skip', 1);
    assert.equal(third.status, 409);
    assert.equal(third.body.error.code, 'no_freezes');
    await log('done', 1);
    const res = await log('done', 0);
    assert.equal(res.body.streak.current, 3);
    assert.equal(res.body.streak.freezesLeft, 0);
  });

  it('rechaza fechas futuras o demasiado antiguas', async () => {
    const { client } = await newUser(base);
    const habit = (await client.post('/habits', reading)).body;
    const today = localToday('America/Bogota');
    for (const localDate of [addDays(today, 1), addDays(today, -30)]) {
      const res = await client.post(`/habits/${habit.id}/logs`, {
        status: 'done',
        localDate,
        clientId: randomUUID(),
      });
      assert.equal(res.status, 400);
    }
  });

  it('hábito a romper: recaída privada, contador de libertad y XP que nunca baja', async () => {
    const { client } = await newUser(base);
    const habit = (
      await client.post('/habits', {
        kind: 'break',
        identity: 'free',
        title: 'Redes de noche',
        triggers: ['aburrimiento'],
        substitute: 'Leer',
        savingsPerDay: 2,
        savingsUnit: 'h',
      })
    ).body;
    assert.equal(habit.freedom.days, 0);
    assert.equal(habit.relapseVisibility, 'private');

    const resisted = await client.post(`/habits/${habit.id}/logs`, {
      status: 'done',
      clientId: randomUUID(),
    });
    assert.equal(resisted.status, 201);
    const xpBefore = (await client.get('/me/progress')).body.totalXp;

    const db = getApp().get<Db>(DB);
    await db
      .update(habits)
      .set({ startDate: addDays(localToday('America/Bogota'), -3) })
      .where(eq(habits.id, habit.id));
    const relapse = await client.post(`/habits/${habit.id}/logs`, {
      status: 'relapse',
      localDate: addDays(localToday('America/Bogota'), -1),
      clientId: randomUUID(),
    });
    assert.equal(relapse.status, 201);
    assert.equal(relapse.body.streak.current, 0);
    const xpAfter = (await client.get('/me/progress')).body.totalXp;
    assert.equal(xpAfter, xpBefore);

    const skip = await client.post(`/habits/${habit.id}/logs`, {
      status: 'skip',
      clientId: randomUUID(),
    });
    assert.equal(skip.status, 400);
  });

  it('sincroniza un lote offline y responde por registro', async () => {
    const { client } = await newUser(base);
    const habit = (await client.post('/habits', reading)).body;
    const today = localToday('America/Bogota');
    const c1 = randomUUID();
    const res = await client.post('/logs/sync', {
      logs: [
        { habitId: habit.id, localDate: today, status: 'done', clientId: c1 },
        { habitId: habit.id, localDate: today, status: 'done', clientId: c1 },
        { habitId: randomUUID(), localDate: today, status: 'done', clientId: randomUUID() },
      ],
    });
    assert.equal(res.status, 200);
    const [first, second, third] = res.body.results;
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.response.duplicate, true);
    assert.equal(third.ok, false);
  });

  it('progreso con niveles por identidad, mapa de calor y misiones', async () => {
    const { client } = await newUser(base);
    const habit = (await client.post('/habits', reading)).body;
    await client.post(`/habits/${habit.id}/logs`, { status: 'done', clientId: randomUUID() });
    const res = await client.get('/me/progress');
    assert.equal(res.status, 200);
    const reader = res.body.identities.find((i: { identity: string }) => i.identity === 'reader');
    assert.equal(reader.votes, 1);
    assert.equal(reader.xp, 30);
    assert.match(reader.title, /Lector/);
    assert.equal(res.body.heatmap.length, 1);
    assert.equal(res.body.missions.length, 3);
  });
});
