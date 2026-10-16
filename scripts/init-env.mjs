#!/usr/bin/env node
// Crea el .env de la raíz a partir de .env.example y completa los secretos vacíos
// (JWT_SECRET y el par de claves VAPID). No toca un .env que ya existe.
import { createECDH, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '.env');

if (existsSync(target)) {
  console.log('.env ya existe; no se modifica.');
  process.exit(0);
}

// Las claves VAPID son un par ECDSA P-256 en base64url, igual que `web-push generate-vapid-keys`.
const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const secrets = {
  JWT_SECRET: randomBytes(48).toString('base64url'),
  VAPID_PUBLIC_KEY: ecdh.getPublicKey().toString('base64url'),
  VAPID_PRIVATE_KEY: ecdh.getPrivateKey().toString('base64url'),
};

const content = readFileSync(join(root, '.env.example'), 'utf8').replace(
  /^(JWT_SECRET|VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY)=$/gm,
  (_, key) => `${key}=${secrets[key]}`,
);
writeFileSync(target, content, { mode: 0o600 });
console.log('.env creado con secretos nuevos.');
