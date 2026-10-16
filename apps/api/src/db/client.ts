import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

export function createDb(url: string) {
  const pool = new Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return { db, pool };
}
