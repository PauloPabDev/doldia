import 'reflect-metadata';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { RateLimiter } from '../src/common/rate-limiter';
import { createDb } from '../src/db/client';

let app: INestApplication | undefined;
let baseUrl = '';

/** Base de datos aislada para pruebas: habitos_test, recreada en cada archivo de pruebas. */
async function prepareDatabase() {
  const devUrl = new URL(
    process.env.DATABASE_URL ?? 'postgres://habitos:habitos@127.0.0.1:5442/habitos',
  );
  devUrl.pathname = '/habitos';
  const testUrl = new URL(devUrl);
  testUrl.pathname = '/habitos_test';
  const admin = new Client({ connectionString: devUrl.toString() });
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS habitos_test WITH (FORCE)');
  await admin.query('CREATE DATABASE habitos_test');
  await admin.end();
  const { db, pool } = createDb(testUrl.toString());
  await migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') });
  await pool.end();
  return testUrl.toString();
}

export async function startApp() {
  if (app) return baseUrl;
  process.env.DATABASE_URL = await prepareDatabase();
  process.env.NODE_ENV = 'test';
  process.env.WORKER_ENABLED = 'false';
  const { createApp } = await import('../src/bootstrap');
  app = await createApp();
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;
  return baseUrl;
}

export async function stopApp() {
  await app?.close();
  app = undefined;
}

export function getApp() {
  if (!app) throw new Error('La app no está iniciada');
  return app;
}

// biome-ignore lint/suspicious/noExplicitAny: respuestas de prueba sin tipar
type Json = any;

/** Cliente HTTP con su propio tarro de cookies, como un navegador. */
export class TestClient {
  readonly cookies = new Map<string, string>();

  constructor(private readonly base: string) {}

  async request(
    method: string,
    url: string,
    body?: unknown,
    opts: { csrf?: boolean } = {},
  ): Promise<{ status: number; body: Json; headers: Headers }> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (opts.csrf !== false) headers['x-requested-with'] = 'fetch';
    if (this.cookies.size) {
      headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    const res = await fetch(`${this.base}${url}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const raw of res.headers.getSetCookie()) {
      const pair = raw.split(';')[0] ?? '';
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (!value || /expires=thu, 01 jan 1970/i.test(raw)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined, headers: res.headers };
  }

  get = (url: string) => this.request('GET', url);
  post = (url: string, body?: unknown) => this.request('POST', url, body ?? {});
  patch = (url: string, body?: unknown) => this.request('PATCH', url, body ?? {});
  del = (url: string) => this.request('DELETE', url);
}

let counter = 0;
export async function newUser(base: string, overrides: Record<string, unknown> = {}) {
  // El límite de registros por IP es real; en pruebas todo sale de 127.0.0.1.
  getApp().get(RateLimiter).reset();
  const client = new TestClient(base);
  counter++;
  const email = `user${Date.now()}${counter}@test.dev`;
  const res = await client.post('/auth/register', {
    email,
    password: 'contraseña-segura',
    displayName: `Persona ${counter}`,
    timezone: 'America/Bogota',
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`registro falló: ${JSON.stringify(res.body)}`);
  return { client, email, user: res.body.user as { id: string; displayName: string } };
}
