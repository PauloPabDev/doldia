import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApp } from './bootstrap';
import { loadEnv } from './config';

async function main() {
  const env = loadEnv();
  const app = await createApp();
  await app.listen(env.API_PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`API escuchando en :${env.API_PORT}/api/v1`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
