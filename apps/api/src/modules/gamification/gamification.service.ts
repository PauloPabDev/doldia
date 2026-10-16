import {
  ACHIEVEMENTS,
  type AchievementCode,
  type GainedReward,
  IDENTITIES,
  type IdentityKey,
  levelFromXp,
  levelTitle,
  type ProgressResponse,
  XP,
} from '@habitos/contracts';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { and, count, countDistinct, eq, gte, inArray, sql, sum } from 'drizzle-orm';
import { addDays, localToday, zonedParts } from '../../common/time';
import type { Db } from '../../db/client';
import { InjectDb } from '../../db/db.module';
import {
  achievements,
  habitLogs,
  habits,
  reactions,
  userAchievements,
  users,
  xpEvents,
} from '../../db/schema';
import { NotificationsService } from '../notifications/notifications.service';

type HabitRow = typeof habits.$inferSelect;
type LogRow = typeof habitLogs.$inferSelect;

export interface LogContext {
  streakCurrent: number;
  freedomDays: number | null;
  hadRelapse: boolean;
  comeback: boolean;
}

/** Lunes de la semana local que contiene `date`. */
export function weekStart(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

@Injectable()
export class GamificationService implements OnModuleInit {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly notifications: NotificationsService,
  ) {}

  /** Los logros se definen como datos en contracts y se sincronizan al arrancar. */
  async onModuleInit() {
    const rows = Object.entries(ACHIEVEMENTS).map(([code, a]) => ({ code, ...a }));
    await this.db
      .insert(achievements)
      .values(rows)
      .onConflictDoUpdate({
        target: achievements.code,
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          icon: sql`excluded.icon`,
        },
      });
  }

  async identityXp(userId: string, identity: string) {
    const [row] = await this.db
      .select({ total: sum(xpEvents.amount) })
      .from(xpEvents)
      .where(and(eq(xpEvents.userId, userId), eq(xpEvents.identity, identity)));
    return Number(row?.total ?? 0);
  }

  /** Premia un registro. El XP es un libro mayor: nunca baja por una recaída. */
  async awardForLog(habit: HabitRow, log: LogRow, ctx: LogContext): Promise<GainedReward> {
    const userId = habit.userId;
    const reward: GainedReward = { xp: 0, levelUp: null, achievements: [] };
    const before = await this.identityXp(userId, habit.identity);

    const [firstEver] = await this.db
      .select({ n: count() })
      .from(xpEvents)
      .where(and(eq(xpEvents.userId, userId), eq(xpEvents.reason, 'log')));

    const amount = log.status === 'done' ? XP.done : log.status === 'min' ? XP.min : 0;
    if (amount > 0) {
      const inserted = await this.db
        .insert(xpEvents)
        .values({ userId, identity: habit.identity, amount, reason: 'log', refId: log.id })
        .onConflictDoNothing()
        .returning({ id: xpEvents.id });
      if (inserted.length) reward.xp += amount;

      if ((firstEver?.n ?? 0) === 0 && inserted.length) {
        await this.db
          .insert(xpEvents)
          .values({
            userId,
            identity: habit.identity,
            amount: XP.firstLog,
            reason: 'first_log',
            refId: log.id,
          })
          .onConflictDoNothing();
        reward.xp += XP.firstLog;
      }
      if (ctx.comeback) {
        const bonus = await this.db
          .insert(xpEvents)
          .values({
            userId,
            identity: habit.identity,
            amount: XP.relapseRecovered,
            reason: 'comeback',
            refId: log.id,
          })
          .onConflictDoNothing()
          .returning({ id: xpEvents.id });
        if (bonus.length) reward.xp += XP.relapseRecovered;
      }
    }

    const unlock = async (code: AchievementCode) => {
      if (await this.unlock(userId, code)) {
        reward.achievements.push({ code, title: ACHIEVEMENTS[code].title });
      }
    };
    if (amount > 0) await unlock('first_vote');
    if (habit.kind === 'build') {
      if (ctx.streakCurrent >= 7) await unlock('week_one');
      if (ctx.streakCurrent >= 21) await unlock('three_weeks');
      if (ctx.streakCurrent >= 30) await unlock('month');
      if (ctx.comeback && amount > 0) await unlock('comeback');
    } else if (ctx.hadRelapse && (ctx.freedomDays ?? 0) >= 7) {
      await unlock('relapse_overcome');
    }

    const after = before + reward.xp;
    const levelBefore = levelFromXp(before).level;
    const levelAfter = levelFromXp(after).level;
    if (levelAfter > levelBefore) {
      const identity = habit.identity as IdentityKey;
      reward.levelUp = { identity, level: levelAfter, title: levelTitle(identity, levelAfter) };
      await unlock('level_up');
      await this.notifications.notify(userId, 'achievement', {
        title: `¡Nuevo nivel: ${reward.levelUp.title}!`,
        body: `Cada voto cuenta. Ya eres nivel ${levelAfter} en ${IDENTITIES[identity].label}.`,
        url: '/progreso',
      });
    }
    return reward;
  }

  /** Desbloquea un logro una sola vez; devuelve true si es nuevo. */
  async unlock(userId: string, code: AchievementCode) {
    const inserted = await this.db
      .insert(userAchievements)
      .values({ userId, code })
      .onConflictDoNothing()
      .returning({ code: userAchievements.code });
    if (!inserted.length) return false;
    const a = ACHIEVEMENTS[code];
    await this.notifications.notify(userId, 'achievement', {
      title: `Logro: ${a.title}`,
      body: a.description,
      url: '/progreso',
    });
    return true;
  }

  async progress(userId: string, now = new Date()): Promise<ProgressResponse> {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    const tz = user?.timezone ?? 'UTC';
    const today = localToday(tz, now);

    const xpRows = await this.db
      .select({ identity: xpEvents.identity, xp: sum(xpEvents.amount) })
      .from(xpEvents)
      .where(eq(xpEvents.userId, userId))
      .groupBy(xpEvents.identity);

    const voteRows = await this.db
      .select({ identity: habits.identity, votes: count() })
      .from(habitLogs)
      .innerJoin(habits, eq(habits.id, habitLogs.habitId))
      .where(and(eq(habitLogs.userId, userId), inArray(habitLogs.status, ['done', 'min'])))
      .groupBy(habits.identity);

    const habitIdentities = await this.db
      .selectDistinct({ identity: habits.identity })
      .from(habits)
      .where(eq(habits.userId, userId));

    const identities = new Set<string>([
      ...xpRows.map((r) => r.identity),
      ...habitIdentities.map((r) => r.identity),
    ]);
    const xpBy = new Map(xpRows.map((r) => [r.identity, Number(r.xp ?? 0)]));
    const votesBy = new Map(voteRows.map((r) => [r.identity, r.votes]));

    const identityList = [...identities]
      .filter((i): i is IdentityKey => i in IDENTITIES)
      .map((identity) => {
        const xp = xpBy.get(identity) ?? 0;
        const lvl = levelFromXp(xp);
        return {
          identity,
          xp,
          votes: votesBy.get(identity) ?? 0,
          level: lvl.level,
          title: levelTitle(identity, lvl.level),
          nextLevelXp: lvl.next,
          progress: lvl.progress,
        };
      })
      .sort((a, b) => b.xp - a.xp);

    const unlocked = await this.db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId))
      .orderBy(userAchievements.unlockedAt);

    const from = addDays(today, -119);
    const heat = await this.db
      .select({ date: habitLogs.localDate, count: count() })
      .from(habitLogs)
      .where(
        and(
          eq(habitLogs.userId, userId),
          gte(habitLogs.localDate, from),
          inArray(habitLogs.status, ['done', 'min']),
        ),
      )
      .groupBy(habitLogs.localDate);

    return {
      totalXp: identityList.reduce((acc, i) => acc + i.xp, 0),
      identities: identityList,
      achievements: unlocked.map((u) => {
        const a = ACHIEVEMENTS[u.code as AchievementCode];
        return {
          code: u.code,
          title: a?.title ?? u.code,
          icon: a?.icon ?? 'star',
          unlockedAt: u.unlockedAt.toISOString(),
        };
      }),
      heatmap: heat
        .map((h) => ({ date: h.date, count: h.count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      missions: await this.missions(userId, tz, today),
    };
  }

  /** Tres retos pequeños que se renuevan cada lunes. */
  private async missions(userId: string, tz: string, today: string) {
    const monday = weekStart(today);
    const weekLogs = await this.db
      .select({
        localDate: habitLogs.localDate,
        status: habitLogs.status,
        createdAt: habitLogs.createdAt,
      })
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), gte(habitLogs.localDate, monday)));

    const counted = weekLogs.filter((l) => l.status === 'done' || l.status === 'min');
    const earlyDays = new Set(
      counted
        .filter((l) => {
          const p = zonedParts(l.createdAt, tz);
          return p.date === l.localDate && p.hour < 9;
        })
        .map((l) => l.localDate),
    );
    const [reacted] = await this.db
      .select({ n: countDistinct(reactions.logId) })
      .from(reactions)
      .where(
        and(
          eq(reactions.userId, userId),
          gte(reactions.createdAt, new Date(`${monday}T00:00:00Z`)),
        ),
      );

    return [
      {
        code: 'early_bird',
        title: 'Registra 5 días antes de las 9 a. m.',
        progress: Math.min(earlyDays.size, 5),
        goal: 5,
      },
      {
        code: 'full_week',
        title: 'Registra algo los 7 días',
        progress: Math.min(new Set(counted.map((l) => l.localDate)).size, 7),
        goal: 7,
      },
      {
        code: 'cheer',
        title: 'Reacciona a 5 registros de tus amigos',
        progress: Math.min(reacted?.n ?? 0, 5),
        goal: 5,
      },
    ];
  }

  async countReactionsGiven(userId: string) {
    const [row] = await this.db
      .select({ n: count() })
      .from(reactions)
      .where(eq(reactions.userId, userId));
    return row?.n ?? 0;
  }
}
