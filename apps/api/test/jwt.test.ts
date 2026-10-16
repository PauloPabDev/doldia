import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { signJwt, verifyJwt } from '../src/modules/auth/jwt';
import { hashPassword, verifyPassword } from '../src/modules/auth/password';

const secret = 'a'.repeat(48);
const issuer = 'habitos';
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const hmac = (body: string) => createHmac('sha256', secret).update(body).digest('base64url');

describe('JWT con node:crypto', () => {
  const token = signJwt({ sub: 'u1', sid: 's1' }, { secret, issuer, ttlSeconds: 900 });

  it('acepta un token válido', () => {
    const payload = verifyJwt(token, { secrets: [secret], issuer });
    assert.equal(payload.sub, 'u1');
    assert.equal(payload.sid, 's1');
    assert.equal(payload.exp - payload.iat, 900);
  });

  it('rechaza una firma alterada', () => {
    const [h, p, s = ''] = token.split('.');
    const flipped = s.startsWith('A') ? `B${s.slice(1)}` : `A${s.slice(1)}`;
    assert.throws(
      () => verifyJwt(`${h}.${p}.${flipped}`, { secrets: [secret], issuer }),
      /Firma inválida/,
    );
  });

  it('rechaza un payload modificado', () => {
    const [h, , s] = token.split('.');
    const forged = `${h}.${b64({ sub: 'admin', sid: 's1', iat: 0, exp: 9e9, iss: issuer })}.${s}`;
    assert.throws(() => verifyJwt(forged, { secrets: [secret], issuer }), /Firma inválida/);
  });

  it('rechaza un token expirado', () => {
    const old = signJwt(
      { sub: 'u1', sid: 's1' },
      { secret, issuer, ttlSeconds: 60, now: Date.now() - 120_000 },
    );
    assert.throws(() => verifyJwt(old, { secrets: [secret], issuer }), /expirado/);
  });

  it('rechaza alg: none', () => {
    const claims = b64({ sub: 'u1', sid: 's1', iat: 0, exp: 9e9, iss: issuer });
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${claims}.`;
    assert.throws(() => verifyJwt(none, { secrets: [secret], issuer }), /Algoritmo no permitido/);
  });

  it('rechaza otros algoritmos aunque la firma HMAC coincida', () => {
    const body = `${b64({ alg: 'HS512', typ: 'JWT' })}.${b64({ sub: 'u1', sid: 's1', iat: 0, exp: 9e9, iss: issuer })}`;
    assert.throws(
      () => verifyJwt(`${body}.${hmac(body)}`, { secrets: [secret], issuer }),
      /Algoritmo/,
    );
  });

  it('rechaza tokens sin exp', () => {
    const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', sid: 's1', iss: issuer })}`;
    assert.throws(
      () => verifyJwt(`${body}.${hmac(body)}`, { secrets: [secret], issuer }),
      /sin expiración/,
    );
  });

  it('rechaza otro emisor', () => {
    const other = signJwt({ sub: 'u1', sid: 's1' }, { secret, issuer: 'otro', ttlSeconds: 900 });
    assert.throws(() => verifyJwt(other, { secrets: [secret], issuer }), /Emisor/);
  });

  it('acepta el secreto anterior durante la rotación', () => {
    const previous = 'b'.repeat(48);
    const legacy = signJwt({ sub: 'u1', sid: 's1' }, { secret: previous, issuer, ttlSeconds: 900 });
    assert.equal(verifyJwt(legacy, { secrets: [secret, previous], issuer }).sub, 'u1');
    assert.throws(() => verifyJwt(legacy, { secrets: [secret], issuer }), /Firma/);
  });

  it('rechaza basura', () => {
    for (const bad of ['', 'a.b', 'a.b.c', '...', 'eyJ.eyJ.sig']) {
      assert.throws(() => verifyJwt(bad, { secrets: [secret], issuer }));
    }
  });
});

describe('Contraseñas con scrypt', () => {
  it('hashea con sal aleatoria y verifica', async () => {
    const a = await hashPassword('mi clave');
    const b = await hashPassword('mi clave');
    assert.notEqual(a, b);
    assert.ok(await verifyPassword('mi clave', a));
    assert.ok(!(await verifyPassword('otra clave', a)));
    assert.ok(!(await verifyPassword('mi clave', 'basura')));
  });
});
