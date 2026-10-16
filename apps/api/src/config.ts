import { z } from 'zod';

const secret = z.string().min(32, 'debe tener al menos 32 caracteres');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(3101),
  DATABASE_URL: z.url(),
  JWT_SECRET: secret,
  JWT_SECRET_PREVIOUS: z.preprocess((v) => (v === '' ? undefined : v), secret.optional()),
  JWT_ISSUER: z.string().min(1).default('habitos'),
  VAPID_PUBLIC_KEY: z.string().min(20),
  VAPID_PRIVATE_KEY: z.string().min(20),
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:)/),
  PUBLIC_URL: z.url().default('http://localhost:8180'),
  /** Desactiva el worker (útil en pruebas o en réplicas que solo atienden HTTP). */
  WORKER_ENABLED: z.enum(['true', 'false']).default('true'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Valida los secretos al arrancar: si falta uno, la API no inicia. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuración inválida, la API no puede iniciar:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache() {
  cached = undefined;
}
