import { Controller, Get, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { Public } from '../../common/decorators';
import { PG_POOL } from '../../db/db.module';

@Controller('health')
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly handle: { pool: Pool }) {}

  @Public()
  @Get()
  async health() {
    let db = 'ok';
    try {
      await this.handle.pool.query('select 1');
    } catch {
      db = 'down';
    }
    return { status: db === 'ok' ? 'ok' : 'degraded', db, time: new Date().toISOString() };
  }
}
