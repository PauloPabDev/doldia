import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no está definida');
  const { db, pool } = createDb(url);
  await migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') });
  await pool.end();
  console.log('Migraciones aplicadas');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
