import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import type { Pool } from 'pg';
import { loadEnv } from '../config';
import { createDb, Db } from './client';

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');
export const InjectDb = () => Inject(DB);

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => createDb(loadEnv().DATABASE_URL),
    },
    {
      provide: DB,
      inject: [PG_POOL],
      useFactory: (handle: { db: Db }) => handle.db,
    },
  ],
  exports: [DB, PG_POOL],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly handle: { pool: Pool }) {}

  async onApplicationShutdown() {
    await this.handle.pool.end();
  }
}
