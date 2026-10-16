import { IDENTITIES, type IdentityKey } from '@habitos/contracts';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { addDays, localToday, minutesOf, zonedParts } from '../common/time';
import { uuidv7 } from '../common/uuid';
import { loadEnv } from '../config';
import type { Db } from '../db/client';
import { InjectDb, PG_POOL } from '../db/db.module';
import { habitLogs, habits, streaks, users } from '../db/schema';
import { FeedService } from '../modules/feed/feed.service';
import { weekStart } from '../modules/gamification/gamification.service';
import { FREEZES_PER_WEEK, HabitsService } from '../modules/habits/habits.service';
import { buildStreak } from '../modules/habits/streak';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { JobsService } from './jobs.service';

const TICK_MS = 30_000;
/** Clave del candado consultivo para que solo una instancia haga el cierre diario. */
const DAILY_LOCK = 724_001;
const MAX_CATCHUP_DAYS = 7;
const WEEKLY_SUMMARY_HOUR = 18;

type UserRow = typeof users.$inferSelect;

@Injectable()
export class WorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Worker');
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @InjectDb() private readonly db: Db,
    @Inject(PG_POOL) private readonly handle: { pool: Pool },
    private readonly jobs: JobsService,
    private readonly habits: HabitsService,
    private readonly feed: FeedService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    if (loadEnv().WORKER_ENABLED !== 'true') return;
    // setInterval + SKIP LOCKED en lugar de @nestjs/schedule.
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      await this.jobs.releaseStale();
      await this.runDueJobs(now);
      await this.runDaily(now);
    } catch (err) {
      this.logger.error(err instanceof Error ? err.stack : String(err));
    } finally {
      this.running = false;
    }
  }

  async runDueJobs(now = new Date()) {
    for (;;) {
      const batch = await this.jobs.claim(20, now);
      if (!batch.length) return;
      for (const job of batch) {
        try {
          await this.dispatch(job.type, job.payload, now);
          await this.jobs.complete(job.id);
        } catch (err) {
          await this.jobs.fail(
            job.id,
            job.attempts,
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    }
  }

  private async dispatch(type: string, payload: Record<string, unknown>, now: Date) {
    if (type === 'reminder') return this.reminder(String(payload.habitId), now);
    if (type === 'reaction_digest') {
      return void (await this.feed.reactionDigest(
        String(payload.userId),
        new Date(String(payload.since)),
      ));
    }
    this.logger.warn(`Trabajo desconocido: ${type}`);
  }

  /** Recordatorio a la hora de la señal; se omite si ya registró y siempre se reprograma. */
  private async reminder(habitId: string, now: Date) {
    const [row] = await this.db
      .select()
      .from(habits)
      .innerJoin(users, eq(users.id, habits.userId))
      .where(eq(habits.id, habitId));
    if (!row || row.habits.archivedAt || !row.habits.cueTime) return;
    const habit = row.habits;
    const tz = row.users.timezone;
    const today = localToday(tz, now);

    const [logged] = await this.db
      .select({ id: habitLogs.id })
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.localDate, today)));

    if (!logged) {
      const place = habit.cuePlace ? ` en ${habit.cuePlace}` : '';
      await this.notifications.notify(
        habit.userId,
        'reminder',
        {
          title:
            habit.kind === 'break'
              ? `Hoy eliges ${IDENTITIES[habit.identity as IdentityKey]?.noun ?? 'tu camino'}`
              : habit.title,
          body: habit.minVersion
            ? `Es la hora${place}. Con "${habit.minVersion}" ya cuenta.`
            : `Es la hora${place}. Un voto más por ${IDENTITIES[habit.identity as IdentityKey]?.noun ?? 'quien quieres ser'}.`,
          url: `/hoy?registrar=${habit.id}`,
          push: {
            habitId: habit.id,
            tag: `reminder-${habit.id}`,
            actions:
              habit.kind === 'build'
                ? [
                    { action: 'done', title: 'Hecho' },
                    { action: 'min', title: 'Versión de 2 min' },
                  ]
                : [],
          },
        },
        now,
      );
    }
    // Siguiente: un minuto después de ahora para no reagendar el mismo instante.
    await this.habits.scheduleReminder(habit, tz, new Date(now.getTime() + 60_000));
  }

  /** Cierre diario por zona horaria, aviso de riesgo y resumen semanal, bajo candado consultivo. */
  async runDaily(now = new Date()) {
    const client = await this.handle.pool.connect();
    try {
      const { rows } = await client.query<{ ok: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS ok',
        [DAILY_LOCK],
      );
      if (!rows[0]?.ok) return;
      try {
        const all = await this.db.select().from(users);
        for (const user of all) {
          await this.closeDays(user, now);
          await this.streakRisk(user, now);
          await this.weeklySummary(user, now);
        }
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [DAILY_LOCK]);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Cierra cada día local terminado: si un hábito quedó sin registro y había
   * racha, consume un comodín automáticamente (nunca fallar dos veces).
   * Los lunes se renuevan los comodines.
   */
  async closeDays(user: UserRow, now: Date) {
    const today = localToday(user.timezone, now);
    const yesterday = addDays(today, -1);
    if (!user.lastClosedDate) {
      await this.db.update(users).set({ lastClosedDate: yesterday }).where(eq(users.id, user.id));
      return;
    }
    if (user.lastClosedDate >= yesterday) return;

    let day = addDays(user.lastClosedDate, 1);
    if (addDays(day, MAX_CATCHUP_DAYS) < yesterday) day = addDays(yesterday, -MAX_CATCHUP_DAYS);

    const active = await this.db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, user.id), isNull(habits.archivedAt)));

    for (; day <= yesterday; day = addDays(day, 1)) {
      for (const habit of active) {
        if (habit.kind !== 'build' || habit.startDate > day) continue;
        await this.db.transaction(async (tx) => {
          const logs = await tx
            .select({ localDate: habitLogs.localDate, status: habitLogs.status })
            .from(habitLogs)
            .where(
              and(
                eq(habitLogs.habitId, habit.id),
                gte(habitLogs.localDate, addDays(day, -60)),
                lte(habitLogs.localDate, day),
              ),
            );
          if (logs.some((l) => l.localDate === day)) return;
          // ¿Había racha viva hasta el día anterior?
          const before = buildStreak(logs, addDays(day, -1));
          if (before.current === 0) return;
          const [spent] = await tx
            .update(streaks)
            .set({ freezesLeft: sql`${streaks.freezesLeft} - 1` })
            .where(and(eq(streaks.habitId, habit.id), sql`${streaks.freezesLeft} > 0`))
            .returning();
          if (!spent) return;
          await tx
            .insert(habitLogs)
            .values({
              habitId: habit.id,
              userId: user.id,
              localDate: day,
              status: 'skip',
              note: 'Comodín automático',
              clientId: uuidv7(),
            })
            .onConflictDoNothing();
        });
      }
      // El domingo cierra la semana: el lunes empieza con comodines nuevos.
      if (new Date(`${day}T00:00:00Z`).getUTCDay() === 0 && active.length) {
        await this.db
          .update(streaks)
          .set({ freezesLeft: FREEZES_PER_WEEK })
          .where(
            inArray(
              streaks.habitId,
              active.map((h) => h.id),
            ),
          );
      }
    }

    for (const habit of active) await this.habits.recomputeStreak(habit, today);
    await this.db.update(users).set({ lastClosedDate: yesterday }).where(eq(users.id, user.id));
  }

  /**
   * Aviso de riesgo de racha: dos horas antes del horario silencioso (por
   * defecto 20:00), solo si hay racha viva y aún no hay registro hoy.
   */
  async streakRisk(user: UserRow, now: Date) {
    const parts = zonedParts(now, user.timezone);
    const riskAt = Math.max(0, minutesOf(user.quietStart) - 120);
    if (parts.hour * 60 + parts.minute < riskAt) return;
    if (user.riskNotifiedDate === parts.date) return;
    await this.db.update(users).set({ riskNotifiedDate: parts.date }).where(eq(users.id, user.id));

    const rows = await this.db
      .select({ habit: habits, current: streaks.current })
      .from(habits)
      .innerJoin(streaks, eq(streaks.habitId, habits.id))
      .where(and(eq(habits.userId, user.id), isNull(habits.archivedAt), eq(habits.kind, 'build')));
    if (!rows.length) return;
    const loggedToday = await this.db
      .select({ habitId: habitLogs.habitId })
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, user.id), eq(habitLogs.localDate, parts.date)));
    const done = new Set(loggedToday.map((l) => l.habitId));
    const atRisk = rows
      .filter((r) => r.current > 0 && !done.has(r.habit.id))
      .sort((a, b) => b.current - a.current);
    const top = atRisk[0];
    if (!top) return;
    const extra = atRisk.length > 1 ? ` y ${atRisk.length - 1} más` : '';
    await this.notifications.notify(
      user.id,
      'streak_risk',
      {
        title: `Tu racha de ${top.current} ${top.current === 1 ? 'día' : 'días'} te espera`,
        body: top.habit.minVersion
          ? `"${top.habit.title}"${extra}: con "${top.habit.minVersion}" ya cuenta.`
          : `"${top.habit.title}"${extra}: todavía estás a tiempo hoy.`,
        url: `/hoy?registrar=${top.habit.id}`,
        push: {
          habitId: top.habit.id,
          actions: [
            { action: 'done', title: 'Hecho' },
            { action: 'min', title: 'Versión de 2 min' },
          ],
        },
      },
      now,
    );
  }

  /** Resumen semanal en lenguaje de identidad, domingo en la tarde hora local. */
  async weeklySummary(user: UserRow, now: Date) {
    const parts = zonedParts(now, user.timezone);
    if (parts.weekday !== 0 || parts.hour < WEEKLY_SUMMARY_HOUR) return;
    if (user.weeklySummaryDate === parts.date) return;
    await this.db.update(users).set({ weeklySummaryDate: parts.date }).where(eq(users.id, user.id));

    const rows = await this.db
      .select({ identity: habits.identity, n: sql<number>`count(*)::int` })
      .from(habitLogs)
      .innerJoin(habits, eq(habits.id, habitLogs.habitId))
      .where(
        and(
          eq(habitLogs.userId, user.id),
          gte(habitLogs.localDate, weekStart(parts.date)),
          inArray(habitLogs.status, ['done', 'min']),
        ),
      )
      .groupBy(habits.identity);
    const total = rows.reduce((acc, r) => acc + r.n, 0);
    if (!total) return;
    const best = [...rows].sort((a, b) => b.n - a.n)[0];
    const noun = IDENTITIES[best?.identity as IdentityKey]?.noun ?? 'tu identidad';
    await this.notifications.notify(
      user.id,
      'weekly_summary',
      {
        title: `Esta semana: ${total} votos`,
        body: `${best?.n ?? 0} fueron por ${noun}. ¿Ajustamos algo para la próxima?`,
        url: '/progreso',
      },
      now,
    );
  }
}
