import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { eq } from 'drizzle-orm';
import { RateLimiter } from '../src/common/rate-limiter';
import type { Db } from '../src/db/client';
import { DB } from '../src/db/db.module';
import { sessions } from '../src/db/schema';
import { getApp, newUser, startApp, stopApp, TestClient } from './helpers';

let base: string;
before(async () => {
  base = await startApp();
});
after(stopApp);

describe('auth', () => {
  it('registra, deja cookies httpOnly y responde /me', async () => {
    const { client, email, user } = await newUser(base);
    assert.ok(client.cookies.get('access'));
    assert.ok(client.cookies.get('refresh'));
    assert.equal(client.cookies.get('hb_session'), '1');
    const me = await client.get('/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.email, email);
    assert.equal(me.body.id, user.id);
    assert.equal(me.body.passwordHash, undefined);
  });

  it('las cookies llevan HttpOnly, SameSite=Lax y rutas acotadas', async () => {
    const c = new TestClient(base);
    getApp().get(RateLimiter).reset();
    const res = await c.post('/auth/register', {
      email: `flags${Date.now()}@test.dev`,
      password: 'contraseña-segura',
      displayName: 'Flags',
    });
    const cookies = res.headers.getSetCookie();
    const access = cookies.find((x) => x.startsWith('access='))!;
    const refresh = cookies.find((x) => x.startsWith('refresh='))!;
    assert.match(access, /HttpOnly/);
    assert.match(access, /SameSite=Lax/);
    assert.match(refresh, /HttpOnly/);
    assert.match(refresh, /Path=\/api\/v1\/auth/);
  });

  it('rechaza correo duplicado y datos inválidos', async () => {
    const { email } = await newUser(base);
    getApp().get(RateLimiter).reset();
    const dup = await new TestClient(base).post('/auth/register', {
      email: email.toUpperCase(),
      password: 'otra-contraseña',
      displayName: 'Otra',
    });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'email_taken');

    const bad = await new TestClient(base).post('/auth/register', {
      email: 'no-es-correo',
      password: '123',
      displayName: '',
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'validation_error');
  });

  it('descarta campos que no están en el esquema', async () => {
    const { client } = await newUser(base);
    const res = await client.patch('/me', { displayName: 'Nuevo', email: 'hack@x.dev', id: 'x' });
    assert.equal(res.status, 200);
    assert.equal(res.body.displayName, 'Nuevo');
    assert.notEqual(res.body.email, 'hack@x.dev');
  });

  it('login correcto e incorrecto', async () => {
    const { email } = await newUser(base);
    getApp().get(RateLimiter).reset();
    const c = new TestClient(base);
    const wrong = await c.post('/auth/login', { email, password: 'equivocada' });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error.message, 'Correo o contraseña incorrectos');
    const ok = await c.post('/auth/login', { email, password: 'contraseña-segura' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.email, email);
  });

  it('limita a 5 intentos de login por minuto', async () => {
    getApp().get(RateLimiter).reset();
    const c = new TestClient(base);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (await c.post('/auth/login', { email: 'nadie@test.dev', password: 'x' })).status,
      );
    }
    assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429]);
    getApp().get(RateLimiter).reset();
  });

  it('sin cookie responde 401 y con token alterado también', async () => {
    const anon = new TestClient(base);
    assert.equal((await anon.get('/me')).status, 401);
    const { client } = await newUser(base);
    const token = client.cookies.get('access')!;
    client.cookies.set('access', `${token.slice(0, -3)}abc`);
    const res = await client.get('/me');
    assert.equal(res.status, 401);
  });

  it('exige X-Requested-With en métodos que modifican datos (CSRF)', async () => {
    const { client } = await newUser(base);
    const res = await client.request('PATCH', '/me', { displayName: 'X' }, { csrf: false });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'csrf');
  });

  it('refresh rota el token y detecta reuso revocando la familia', async () => {
    const { client } = await newUser(base);
    const firstRefresh = client.cookies.get('refresh')!;

    const r1 = await client.post('/auth/refresh');
    assert.equal(r1.status, 200);
    const secondRefresh = client.cookies.get('refresh')!;
    assert.notEqual(firstRefresh, secondRefresh);

    // Saca la sesión rotada del margen de carrera para simular un reuso real.
    const db = getApp().get<Db>(DB);
    await db.update(sessions).set({ rotatedAt: new Date(Date.now() - 60_000) });

    const attacker = new TestClient(base);
    attacker.cookies.set('refresh', firstRefresh);
    const reuse = await attacker.post('/auth/refresh');
    assert.equal(reuse.status, 401);
    assert.equal(reuse.body.error.code, 'session_revoked');

    // El token legítimo también quedó revocado: hay que volver a entrar.
    const legit = await client.post('/auth/refresh');
    assert.equal(legit.status, 401);
  });

  it('dos refrescos simultáneos no cierran la sesión', async () => {
    const { client } = await newUser(base);
    const refresh = client.cookies.get('refresh')!;
    const a = new TestClient(base);
    const b = new TestClient(base);
    a.cookies.set('refresh', refresh);
    b.cookies.set('refresh', refresh);
    const [ra, rb] = await Promise.all([a.post('/auth/refresh'), b.post('/auth/refresh')]);
    assert.equal(ra.status, 200);
    assert.equal(rb.status, 200);
  });

  it('logout borra la sesión y las cookies', async () => {
    const { client, user } = await newUser(base);
    const refresh = client.cookies.get('refresh')!;
    const res = await client.post('/auth/logout');
    assert.equal(res.status, 200);
    assert.equal(client.cookies.has('access'), false);
    const replay = new TestClient(base);
    replay.cookies.set('refresh', refresh);
    assert.equal((await replay.post('/auth/refresh')).status, 401);
    const db = getApp().get<Db>(DB);
    const rows = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    assert.ok(rows.every((r) => r.revokedAt));
  });

  it('cambiar la contraseña cierra las demás sesiones', async () => {
    const { client, email } = await newUser(base);
    getApp().get(RateLimiter).reset();
    const other = new TestClient(base);
    await other.post('/auth/login', { email, password: 'contraseña-segura' });
    const res = await client.post('/auth/password', {
      currentPassword: 'contraseña-segura',
      newPassword: 'nueva-contraseña-1',
    });
    assert.equal(res.status, 200);
    assert.equal((await other.post('/auth/refresh')).status, 401);
    assert.equal((await client.post('/auth/refresh')).status, 200);
  });

  it('errores uniformes sin trazas internas', async () => {
    const { client } = await newUser(base);
    const res = await client.get('/no-existe');
    assert.equal(res.status, 404);
    assert.equal(typeof res.body.error.code, 'string');
    assert.equal(res.body.error.stack, undefined);
  });
});
