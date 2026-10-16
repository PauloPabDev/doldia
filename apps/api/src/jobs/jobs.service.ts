import { Injectable } from '@nestjs/common';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';
import { jobs } from '../db/schema';

export type JobType = 'reminder' | 'reaction_digest';

/** Cola de trabajos diferidos sobre Postgres (sin Redis ni librerías). */
@Injectable()
export class JobsService {
  constructor(@InjectDb() private readonly db: Db) {}

  /** Agenda un trabajo; con `uniqueKey` reemplaza al existente en lugar de duplicarlo. */
  async schedule(type: JobType, runAt: Date, payload: Record<string, unknown>, uniqueKey?: string) {
    await this.db
      .insert(jobs)
      .values({ type, runAt, payload, uniqueKey })
      .onConflictDoUpdate({
        target: jobs.uniqueKey,
        set: { runAt, payload, attempts: 0, lockedAt: null, lastError: null },
      });
  }

  /** Agenda solo si no hay uno pendiente con esa clave (para agrupar avisos). */
  async scheduleOnce(
    type: JobType,
    runAt: Date,
    payload: Record<string, unknown>,
    uniqueKey: string,
  ) {
    await this.db.insert(jobs).values({ type, runAt, payload, uniqueKey }).onConflictDoNothing();
  }

  async cancel(uniqueKey: string) {
    await this.db.delete(jobs).where(eq(jobs.uniqueKey, uniqueKey));
  }

  async find(uniqueKey: string) {
    const [row] = await this.db.select().from(jobs).where(eq(jobs.uniqueKey, uniqueKey));
    return row;
  }

  /** Toma hasta `limit` trabajos vencidos con FOR UPDATE SKIP LOCKED: varias instancias no se pisan. */
  async claim(limit = 20, now = new Date()) {
    const result = await this.db.execute<{
      id: string;
      type: JobType;
      payload: Record<string, unknown>;
      attempts: number;
      unique_key: string | null;
    }>(sql`
      UPDATE ${jobs} SET locked_at = ${now.toISOString()}::timestamptz
      WHERE id IN (
        SELECT id FROM ${jobs}
        WHERE run_at <= ${now.toISOString()}::timestamptz AND locked_at IS NULL
        ORDER BY run_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, type, payload, attempts, unique_key
    `);
    return result.rows;
  }

  /**
   * Borra el trabajo terminado. Si el propio manejador lo reprogramó (misma
   * clave única), la fila ya no está bloqueada y se conserva.
   */
  async complete(id: string) {
    await this.db.delete(jobs).where(and(eq(jobs.id, id), isNotNull(jobs.lockedAt)));
  }

  /** Reintento con espera exponencial; tras 5 intentos el trabajo se descarta. */
  async fail(id: string, attempts: number, error: string) {
    if (attempts + 1 >= 5) {
      await this.db.delete(jobs).where(eq(jobs.id, id));
      return;
    }
    const delayMs = 2 ** attempts * 60_000;
    await this.db
      .update(jobs)
      .set({
        attempts: attempts + 1,
        lastError: error.slice(0, 500),
        lockedAt: null,
        runAt: new Date(Date.now() + delayMs),
      })
      .where(eq(jobs.id, id));
  }

  /** Libera trabajos bloqueados por una instancia que murió a mitad de camino. */
  async releaseStale(olderThanMs = 10 * 60_000) {
    await this.db.execute(
      sql`UPDATE ${jobs} SET locked_at = NULL WHERE locked_at < now() - make_interval(secs => ${olderThanMs / 1000})`,
    );
  }
}
