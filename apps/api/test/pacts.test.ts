import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { PushService } from '../src/modules/notifications/push.service';
import { getApp, newUser, startApp, stopApp } from './helpers';

let base: string;
const pushed: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];

before(async () => {
  base = await startApp();
  getApp()
    .get(PushService)
    .useSender(async (sub, payload) => {
      pushed.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
      return { statusCode: 201 };
    });
});
after(stopApp);

const habitBody = {
  kind: 'build',
  identity: 'athlete',
  title: 'Correr',
  minVersion: 'Ponerme los tenis',
};

async function pactWithFriend() {
  const owner = await newUser(base, { displayName: 'Ana' });
  const friend = await newUser(base, { displayName: 'Beto' });
  const ownerHabit = (await owner.client.post('/habits', habitBody)).body;
  const friendHabit = (await friend.client.post('/habits', { ...habitBody, title: 'Nadar' })).body;
  const pact = (
    await owner.client.post('/pacts', { name: 'Madrugadores', habitIds: [ownerHabit.id] })
  ).body;
  return { owner, friend, ownerHabit, friendHabit, pact };
}

describe('pactos y friends loop', () => {
  it('el invitado ve el pacto y quién lo invitó antes de entrar', async () => {
    const { pact } = await pactWithFriend();
    const anon = await fetch(`${base}/pacts/invite/${pact.inviteCode}`);
    const body = (await anon.json()) as { name: string; invitedBy: string; memberCount: number };
    assert.equal(anon.status, 200);
    assert.equal(body.name, 'Madrugadores');
    assert.equal(body.invitedBy, 'Ana');
    assert.equal(body.memberCount, 1);
  });

  it('el invitado entra por el enlace y su registro aparece en el feed de los demás', async () => {
    const { owner, friend, friendHabit, pact } = await pactWithFriend();
    const join = await friend.client.post(`/pacts/join/${pact.inviteCode}`, {
      habitIds: [friendHabit.id],
    });
    assert.equal(join.status, 200);
    assert.equal(join.body.members.length, 2);

    // Aviso de bienvenida al dueño.
    const inbox = await owner.client.get('/notifications');
    assert.ok(inbox.body.items.some((n: { type: string }) => n.type === 'pact_member'));

    const log = await friend.client.post(`/habits/${friendHabit.id}/logs`, {
      status: 'done',
      clientId: randomUUID(),
    });
    const feed = await owner.client.get(`/pacts/${pact.id}/feed`);
    assert.equal(feed.status, 200);
    assert.equal(feed.body.items[0].logId, log.body.log.id);
    assert.equal(feed.body.items[0].user.displayName, 'Beto');
  });

  it('unirse dos veces es idempotente y no se puede pasar de 8 miembros', async () => {
    const { owner, pact } = await pactWithFriend();
    for (let i = 0; i < 7; i++) {
      const u = await newUser(base);
      const r = await u.client.post(`/pacts/join/${pact.inviteCode}`);
      assert.equal(r.status, 200);
      if (i === 0)
        assert.equal(
          (await u.client.post(`/pacts/join/${pact.inviteCode}`)).body.members.length,
          2,
        );
    }
    const ninth = await newUser(base);
    const full = await ninth.client.post(`/pacts/join/${pact.inviteCode}`);
    assert.equal(full.status, 409);
    assert.equal(full.body.error.code, 'pact_full');
    assert.equal((await owner.client.get(`/pacts/${pact.id}`)).body.members.length, 8);
  });

  it('quien no es miembro no ve el pacto ni su feed', async () => {
    const { pact } = await pactWithFriend();
    const outsider = await newUser(base);
    assert.equal((await outsider.client.get(`/pacts/${pact.id}`)).status, 404);
    assert.equal((await outsider.client.get(`/pacts/${pact.id}/feed`)).status, 404);
  });

  it('las recaídas son privadas por defecto en el feed', async () => {
    const { owner, friend, pact } = await pactWithFriend();
    await friend.client.post(`/pacts/join/${pact.inviteCode}`);
    const quit = (
      await friend.client.post('/habits', { kind: 'break', identity: 'free', title: 'Fumar' })
    ).body;
    await friend.client.request('PUT', `/pacts/${pact.id}/habits`, { habitIds: [quit.id] });
    await friend.client.post(`/habits/${quit.id}/logs`, {
      status: 'relapse',
      clientId: randomUUID(),
    });
    const feed = await owner.client.get(`/pacts/${pact.id}/feed`);
    assert.ok(feed.body.items.every((i: { status: string }) => i.status !== 'relapse'));
  });

  it('reacciones: una por emoji, notifican al dueño y agrupan el push', async () => {
    const { owner, friend, ownerHabit, pact } = await pactWithFriend();
    await friend.client.post(`/pacts/join/${pact.inviteCode}`);
    const log = (
      await owner.client.post(`/habits/${ownerHabit.id}/logs`, {
        status: 'done',
        clientId: randomUUID(),
      })
    ).body.log;
    const r1 = await friend.client.post(`/logs/${log.id}/reactions`, { emoji: '🔥' });
    const r2 = await friend.client.post(`/logs/${log.id}/reactions`, { emoji: '🔥' });
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    const feed = await owner.client.get(`/pacts/${pact.id}/feed`);
    assert.deepEqual(feed.body.items[0].reactions, [{ emoji: '🔥', count: 1, mine: false }]);
    const inbox = await owner.client.get('/notifications');
    assert.equal(inbox.body.items.filter((n: { type: string }) => n.type === 'reaction').length, 1);

    const outsider = await newUser(base);
    assert.equal(
      (await outsider.client.post(`/logs/${log.id}/reactions`, { emoji: '🔥' })).status,
      404,
    );
    assert.equal(
      (await friend.client.post(`/logs/${log.id}/reactions`, { emoji: '💩' })).status,
      400,
    );
  });

  it('empujón: uno por día y hábito, con push y acciones rápidas', async () => {
    const { owner, friend, friendHabit, pact } = await pactWithFriend();
    await friend.client.post(`/pacts/join/${pact.inviteCode}`, { habitIds: [friendHabit.id] });
    await friend.client.post('/push/subscribe', {
      endpoint: `https://push.example.com/${randomUUID()}`,
      keys: { p256dh: 'clave-p256dh', auth: 'clave-auth' },
    });
    // Fuera del horario silencioso para que el push salga a cualquier hora de la prueba.
    await friend.client.patch('/me', { quietStart: '00:00', quietEnd: '00:00' });

    const body = { toUserId: friend.user.id, habitId: friendHabit.id, message: 'together' };
    const first = await owner.client.post('/nudges', body);
    assert.equal(first.status, 200);
    const again = await owner.client.post('/nudges', body);
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'already_nudged');

    const push = pushed.find((p) => (p.payload.title as string).includes('Hoy lo hacemos juntos'));
    assert.ok(push, 'debe enviarse un push');
    assert.equal(push.payload.habitId, friendHabit.id);
    assert.equal((push.payload.actions as unknown[]).length, 2);

    const outsider = await newUser(base);
    assert.equal((await outsider.client.post('/nudges', body)).status, 404);
  });

  it('racha de grupo y meta cooperativa', async () => {
    const { owner, friend, ownerHabit, friendHabit, pact } = await pactWithFriend();
    await friend.client.post(`/pacts/join/${pact.inviteCode}`, { habitIds: [friendHabit.id] });
    await owner.client.post(`/habits/${ownerHabit.id}/logs`, {
      status: 'done',
      clientId: randomUUID(),
    });
    let detail = (await owner.client.get(`/pacts/${pact.id}`)).body;
    assert.equal(detail.groupStreak, 0);
    await friend.client.post(`/habits/${friendHabit.id}/logs`, {
      status: 'min',
      clientId: randomUUID(),
    });
    detail = (await owner.client.get(`/pacts/${pact.id}`)).body;
    assert.equal(detail.groupStreak, 1);
    assert.equal(detail.monthlyCount, 2);
    assert.ok(detail.members.every((m: { loggedToday: boolean }) => m.loggedToday));
  });

  it('solo el dueño rota la invitación; el código anterior deja de servir', async () => {
    const { owner, friend, pact } = await pactWithFriend();
    await friend.client.post(`/pacts/join/${pact.inviteCode}`);
    assert.equal((await friend.client.post(`/pacts/${pact.id}/invite`)).status, 403);
    const rotated = await owner.client.post(`/pacts/${pact.id}/invite`);
    assert.notEqual(rotated.body.inviteCode, pact.inviteCode);
    const late = await newUser(base);
    assert.equal((await late.client.post(`/pacts/join/${pact.inviteCode}`)).status, 404);
  });

  it('si el dueño sale, el pacto pasa al miembro más antiguo', async () => {
    const { owner, friend, pact } = await pactWithFriend();
    await friend.client.post(`/pacts/join/${pact.inviteCode}`);
    assert.equal((await owner.client.del(`/pacts/${pact.id}/members/me`)).status, 200);
    const detail = (await friend.client.get(`/pacts/${pact.id}`)).body;
    assert.equal(detail.members.length, 1);
    assert.equal(detail.members[0].role, 'owner');
  });
});
