import type {
  createHabitInput,
  Habit,
  HabitDetail,
  HabitLog,
  Streak,
  TodayResponse,
  updateHabitInput,
} from '@habitos/contracts';
import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, inArray, isNull } from 'drizzle-orm';
import type { z } from 'zod';
import { badRequest, notFound } from '../../common/errors';
import { addDays, localToday, nextOccurrence } from '../../common/time';
import type { Db } from '../../db/client';
import { InjectDb } from '../../db/db.module';
import { habitLogs, habits, pactHabits, streaks, users } from '../../db/schema';
import { JobsService } from '../../jobs/jobs.service';
import { buildStreak, freedomStreak } from './streak';

type HabitRow = typeof habits.$inferSelect;
type LogRow = typeof habitLogs.$inferSelect;
type StreakRow = typeof streaks.$inferSelect;

export const STREAK_WINDOW_DAYS = 400;
export const FREEZES_PER_WEEK = 2;

export function toLog(row: LogRow): HabitLog {
  return {
    id: row.id,
    habitId: row.habitId,
    localDate: row.localDate,
    status: row.status,
    value: row.value,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toStreak(row: StreakRow | undefined): Streak {
  return {
    current: row?.current ?? 0,
    best: row?.best ?? 0,
    freezesLeft: row?.freezesLeft ?? FREEZES_PER_WEEK,
    lastDate: row?.lastDate ?? null,
  };
}

export function freedomFor(habit: HabitRow, streak: Streak) {
  if (habit.kind !== 'break') return null;
  return {
    days: streak.current,
    saved:
      habit.savingsPerDay != null
        ? Math.round(habit.savingsPerDay * streak.current * 100) / 100
        : null,
  };
}

export const reminderKey = (habitId: string) => `reminder:${habitId}`;

@Injectable()
export class HabitsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly jobs: JobsService,
  ) {}

  async userTz(userId: string) {
    const [u] = await this.db
      .select({ tz: users.timezone })
      .from(users)
      .where(eq(users.id, userId));
    if (!u) throw notFound('Usuario');
    return u.tz;
  }

  async today(userId: string, now = new Date()): Promise<TodayResponse> {
    const tz = await this.userTz(userId);
    const today = localToday(tz, now);
    const list = await this.list(userId, today);
    const votesToday = list.filter(
      (h) => h.today && ['done', 'min'].includes(h.today.status),
    ).length;
    return { localDate: today, habits: list, votesToday };
  }

  async list(userId: string, today?: string): Promise<Habit[]> {
    const day = today ?? localToday(await this.userTz(userId));
    const rows = await this.db
      .select()
      .from(habits)
      .leftJoin(streaks, eq(streaks.habitId, habits.id))
      .where(and(eq(habits.userId, userId), isNull(habits.archivedAt)))
      .orderBy(asc(habits.cueTime), asc(habits.createdAt));
    if (!rows.length) return [];

    const ids = rows.map((r) => r.habits.id);
    const todays = await this.db
      .select()
      .from(habitLogs)
      .where(and(inArray(habitLogs.habitId, ids), eq(habitLogs.localDate, day)));
    const shared = await this.db.select().from(pactHabits).where(inArray(pactHabits.habitId, ids));

    const todayBy = new Map(todays.map((l) => [l.habitId, l]));
    return rows.map((r) =>
      this.toHabit(
        r.habits,
        r.streaks ?? undefined,
        todayBy.get(r.habits.id),
        shared.filter((s) => s.habitId === r.habits.id).map((s) => s.pactId),
      ),
    );
  }

  toHabit(
    row: HabitRow,
    streakRow: StreakRow | undefined,
    todayLog: LogRow | undefined,
    pactIds: string[],
  ): Habit {
    const streak = toStreak(streakRow);
    return {
      id: row.id,
      kind: row.kind,
      identity: row.identity as Habit['identity'],
      title: row.title,
      minVersion: row.minVersion,
      cueTime: row.cueTime,
      cuePlace: row.cuePlace,
      stackedOn: row.stackedOn,
      visibility: row.visibility,
      triggers: row.triggers,
      substitute: row.substitute,
      relapseVisibility: row.relapseVisibility === 'pact' ? 'pact' : 'private',
      savingsPerDay: row.savingsPerDay,
      savingsUnit: row.savingsUnit,
      createdAt: row.createdAt.toISOString(),
      archivedAt: row.archivedAt?.toISOString() ?? null,
      streak,
      today: todayLog ? toLog(todayLog) : null,
      freedom: freedomFor(row, streak),
      pactIds,
    };
  }

  async get(userId: string, habitId: string): Promise<HabitRow> {
    const [row] = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
    if (!row) throw notFound('Hábito');
    return row;
  }

  async detail(userId: string, habitId: string): Promise<HabitDetail> {
    const habit = await this.get(userId, habitId);
    const tz = await this.userTz(userId);
    const today = localToday(tz);
    const [streakRow] = await this.db.select().from(streaks).where(eq(streaks.habitId, habitId));
    const logs = await this.db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), gte(habitLogs.localDate, addDays(today, -119))))
      .orderBy(desc(habitLogs.localDate));
    const [votes] = await this.db
      .select({ n: count() })
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), inArray(habitLogs.status, ['done', 'min'])));
    const shared = await this.db.select().from(pactHabits).where(eq(pactHabits.habitId, habitId));
    return {
      ...this.toHabit(
        habit,
        streakRow,
        logs.find((l) => l.localDate === today),
        shared.map((s) => s.pactId),
      ),
      logs: logs.map(toLog),
      votes: votes?.n ?? 0,
    };
  }

  async create(userId: string, input: z.output<typeof createHabitInput>): Promise<Habit> {
    const tz = await this.userTz(userId);
    if (input.stackedOn) await this.get(userId, input.stackedOn);
    const [row] = await this.db
      .insert(habits)
      .values({
        ...input,
        // Las recaídas solo existen en hábitos a romper; en uno a construir no aplican.
        triggers: input.kind === 'break' ? input.triggers : [],
        substitute: input.kind === 'break' ? input.substitute : null,
        userId,
        startDate: localToday(tz),
      })
      .returning();
    if (!row) throw new Error('No se pudo crear el hábito');
    const [streakRow] = await this.db.insert(streaks).values({ habitId: row.id }).returning();
    await this.scheduleReminder(row, tz);
    return this.toHabit(row, streakRow, undefined, []);
  }

  async update(
    userId: string,
    habitId: string,
    input: z.output<typeof updateHabitInput>,
  ): Promise<Habit> {
    if (input.stackedOn) {
      if (input.stackedOn === habitId)
        throw badRequest('invalid_stack', 'Un hábito no puede apilarse sobre sí mismo');
      await this.get(userId, input.stackedOn);
    }
    const [row] = await this.db
      .update(habits)
      .set(input)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .returning();
    if (!row) throw notFound('Hábito');
    if ('cueTime' in input) await this.scheduleReminder(row, await this.userTz(userId));
    const [habit] = (await this.list(userId)).filter((h) => h.id === habitId);
    if (!habit) throw notFound('Hábito');
    return habit;
  }

  /** Archivar en lugar de borrar: el historial y el XP se conservan. */
  async archive(userId: string, habitId: string) {
    await this.db
      .update(habits)
      .set({ archivedAt: new Date() })
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
    await this.db.delete(pactHabits).where(eq(pactHabits.habitId, habitId));
    await this.jobs.cancel(reminderKey(habitId));
  }

  /** Recalcula y guarda la racha (o el contador de libertad) a partir de los registros. */
  async recomputeStreak(
    habit: HabitRow,
    today: string,
    db: Pick<Db, 'select' | 'insert'> = this.db,
  ) {
    const logs = await db
      .select({ localDate: habitLogs.localDate, status: habitLogs.status })
      .from(habitLogs)
      .where(
        and(
          eq(habitLogs.habitId, habit.id),
          gte(habitLogs.localDate, addDays(today, -STREAK_WINDOW_DAYS)),
        ),
      );
    const computed =
      habit.kind === 'build'
        ? buildStreak(logs, today)
        : freedomStreak(logs, today, habit.startDate);
    const [prev] = await db.select().from(streaks).where(eq(streaks.habitId, habit.id));
    const best = Math.max(prev?.best ?? 0, computed.best);
    const [row] = await db
      .insert(streaks)
      .values({ habitId: habit.id, current: computed.current, best, lastDate: computed.lastDate })
      .onConflictDoUpdate({
        target: streaks.habitId,
        set: { current: computed.current, best, lastDate: computed.lastDate },
      })
      .returning();
    return { row: row as StreakRow, logs };
  }

  /** Agenda el próximo recordatorio a la hora local de la señal; sin hora, lo cancela. */
  async scheduleReminder(habit: HabitRow, tz: string, now = new Date()) {
    if (!habit.cueTime || habit.archivedAt) {
      await this.jobs.cancel(reminderKey(habit.id));
      return;
    }
    await this.jobs.schedule(
      'reminder',
      nextOccurrence(habit.cueTime, tz, now),
      { habitId: habit.id },
      reminderKey(habit.id),
    );
  }

  /** Al cambiar de zona horaria se reprograman todos los recordatorios. */
  async rescheduleAll(userId: string) {
    const tz = await this.userTz(userId);
    const rows = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, userId), isNull(habits.archivedAt)));
    for (const row of rows) await this.scheduleReminder(row, tz);
  }
}
