import type {
  createLogInput,
  LogResponse,
  LogStatus,
  SyncLogsResponse,
  syncLogsInput,
} from '@habitos/contracts';
import { HttpException, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { badRequest, conflict } from '../../common/errors';
import { diffDays, localToday } from '../../common/time';
import type { Db } from '../../db/client';
import { InjectDb } from '../../db/db.module';
import { habitLogs, streaks, xpEvents } from '../../db/schema';
import { GamificationService } from '../gamification/gamification.service';
import { HabitsService, toLog, toStreak } from '../habits/habits.service';
import { isComeback } from '../habits/streak';

/** Cuántos días atrás acepta la cola offline. */
export const BACKFILL_DAYS = 7;

const ALLOWED: Record<'build' | 'break', LogStatus[]> = {
  build: ['done', 'min', 'skip'],
  break: ['done', 'relapse'],
};

type CreateLog = z.output<typeof createLogInput>;

@Injectable()
export class LogsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly habits: HabitsService,
    private readonly gamification: GamificationService,
  ) {}

  async create(
    userId: string,
    habitId: string,
    input: CreateLog,
    now = new Date(),
  ): Promise<LogResponse> {
    const habit = await this.habits.get(userId, habitId);
    const tz = await this.habits.userTz(userId);
    const today = localToday(tz, now);
    const localDate = input.localDate ?? today;

    // Reintentos de la cola offline: el mismo client_id devuelve el registro ya creado.
    const [byClient] = await this.db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), eq(habitLogs.clientId, input.clientId)));
    if (byClient) return this.duplicate(habitId, byClient);

    if (habit.archivedAt) throw conflict('habit_archived', 'Este hábito está archivado');
    if (diffDays(localDate, today) > 0 || diffDays(today, localDate) > BACKFILL_DAYS) {
      throw badRequest('date_out_of_range', 'Solo puedes registrar los últimos 7 días');
    }
    if (diffDays(localDate, habit.startDate) < 0) {
      throw badRequest('date_out_of_range', 'Ese día el hábito aún no existía');
    }
    if (!ALLOWED[habit.kind].includes(input.status)) {
      throw badRequest('invalid_status', 'Ese tipo de registro no aplica a este hábito');
    }

    const [existing] = await this.db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.localDate, localDate)));

    if (existing) {
      // Subir de la versión de 2 minutos a la completa es la única corrección directa.
      if (existing.status === 'min' && input.status === 'done') {
        const [updated] = await this.db
          .update(habitLogs)
          .set({ status: 'done', value: input.value, note: input.note ?? existing.note })
          .where(eq(habitLogs.id, existing.id))
          .returning();
        await this.db
          .insert(xpEvents)
          .values({
            userId,
            identity: habit.identity,
            amount: 5,
            reason: 'upgrade',
            refId: existing.id,
          })
          .onConflictDoNothing();
        const { row } = await this.habits.recomputeStreak(habit, today);
        return {
          log: toLog(updated ?? existing),
          streak: toStreak(row),
          reward: { xp: 5, levelUp: null, achievements: [] },
          duplicate: false,
        };
      }
      if (existing.status === input.status) return this.duplicate(habitId, existing);
      throw conflict('already_logged', 'Ya registraste este hábito ese día');
    }

    const created = await this.db.transaction(async (tx) => {
      if (input.status === 'skip') {
        const [s] = await tx
          .update(streaks)
          .set({ freezesLeft: sql`${streaks.freezesLeft} - 1` })
          .where(and(eq(streaks.habitId, habitId), sql`${streaks.freezesLeft} > 0`))
          .returning();
        if (!s) throw conflict('no_freezes', 'No te quedan comodines esta semana');
      }
      const [log] = await tx
        .insert(habitLogs)
        .values({
          habitId,
          userId,
          localDate,
          status: input.status,
          value: input.value,
          note: input.note,
          clientId: input.clientId,
        })
        .returning();
      if (!log) throw new Error('No se pudo guardar el registro');
      const result = await this.habits.recomputeStreak(habit, today, tx);
      return { log, ...result };
    });

    const reward = await this.gamification.awardForLog(habit, created.log, {
      streakCurrent: created.row.current,
      freedomDays: habit.kind === 'break' ? created.row.current : null,
      hadRelapse: created.logs.some((l) => l.status === 'relapse'),
      comeback:
        habit.kind === 'build' &&
        localDate === today &&
        isComeback(
          created.logs.filter((l) => l.localDate !== today),
          today,
        ),
    });

    return { log: toLog(created.log), streak: toStreak(created.row), reward, duplicate: false };
  }

  private async duplicate(
    habitId: string,
    log: typeof habitLogs.$inferSelect,
  ): Promise<LogResponse> {
    const [s] = await this.db.select().from(streaks).where(eq(streaks.habitId, habitId));
    return {
      log: toLog(log),
      streak: toStreak(s),
      reward: { xp: 0, levelUp: null, achievements: [] },
      duplicate: true,
    };
  }

  /** Deshacer un toque accidental (hoy o ayer). Es una corrección, no un castigo. */
  async undo(userId: string, habitId: string, localDate: string, now = new Date()) {
    const habit = await this.habits.get(userId, habitId);
    const today = localToday(await this.habits.userTz(userId), now);
    if (diffDays(today, localDate) > 1 || diffDays(today, localDate) < 0) {
      throw badRequest('date_out_of_range', 'Solo puedes deshacer registros de hoy o ayer');
    }
    const [log] = await this.db
      .delete(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.localDate, localDate)))
      .returning();
    if (log) {
      await this.db
        .delete(xpEvents)
        .where(and(eq(xpEvents.userId, userId), eq(xpEvents.refId, log.id)));
      if (log.status === 'skip') {
        await this.db
          .update(streaks)
          .set({ freezesLeft: sql`${streaks.freezesLeft} + 1` })
          .where(eq(streaks.habitId, habitId));
      }
    }
    const { row } = await this.habits.recomputeStreak(habit, today);
    return { streak: toStreak(row) };
  }

  /** Sincroniza la cola offline en orden cronológico; cada registro se resuelve por separado. */
  async sync(userId: string, input: z.output<typeof syncLogsInput>): Promise<SyncLogsResponse> {
    const ordered = [...input.logs].sort((a, b) => a.localDate.localeCompare(b.localDate));
    const results: SyncLogsResponse['results'] = [];
    for (const item of ordered) {
      const { habitId, ...log } = item;
      try {
        results.push({
          clientId: item.clientId,
          ok: true,
          response: await this.create(userId, habitId, log),
        });
      } catch (err) {
        const body =
          err instanceof HttpException ? (err.getResponse() as { message?: string }) : undefined;
        results.push({
          clientId: item.clientId,
          ok: false,
          error: body?.message ?? 'No se pudo sincronizar',
        });
      }
    }
    return { results };
  }
}
