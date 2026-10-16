import {
  type FeedItem,
  type FeedResponse,
  NUDGE_MESSAGES,
  type NudgeInput,
} from '@habitos/contracts';
import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { badRequest, conflict, notFound } from '../../common/errors';
import { localToday } from '../../common/time';
import type { Db } from '../../db/client';
import { InjectDb } from '../../db/db.module';
import {
  habitLogs,
  habits,
  nudges,
  pactHabits,
  pactMembers,
  reactions,
  users,
} from '../../db/schema';
import { JobsService } from '../../jobs/jobs.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';

const PAGE = 20;
export const REACTION_DIGEST_DELAY_MS = 10 * 60_000;

/** Qué registros puede ver el pacto: nada privado, sin comodines y recaídas solo si el dueño lo permite. */
const visibleInPact = and(
  ne(habits.visibility, 'private'),
  ne(habitLogs.status, 'skip'),
  or(ne(habitLogs.status, 'relapse'), eq(habits.relapseVisibility, 'pact')),
);

/** Los IDs son UUID v7, ordenados por creación: sirven de cursor estable. */
const cursorSchema = z.uuid();

@Injectable()
export class FeedService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly notifications: NotificationsService,
    private readonly gamification: GamificationService,
    private readonly jobs: JobsService,
  ) {}

  async feed(userId: string, pactId: string, cursor?: string): Promise<FeedResponse> {
    const after = cursor === undefined ? undefined : cursorSchema.safeParse(cursor);
    if (after && !after.success) throw badRequest('invalid_cursor', 'Cursor inválido');
    const rows = await this.db
      .select({
        logId: habitLogs.id,
        status: habitLogs.status,
        localDate: habitLogs.localDate,
        note: habitLogs.note,
        createdAt: habitLogs.createdAt,
        userId: users.id,
        displayName: users.displayName,
        habitId: habits.id,
        title: habits.title,
        identity: habits.identity,
        kind: habits.kind,
      })
      .from(habitLogs)
      .innerJoin(
        pactHabits,
        and(eq(pactHabits.habitId, habitLogs.habitId), eq(pactHabits.pactId, pactId)),
      )
      .innerJoin(habits, eq(habits.id, habitLogs.habitId))
      .innerJoin(users, eq(users.id, habitLogs.userId))
      .innerJoin(
        pactMembers,
        and(eq(pactMembers.pactId, pactId), eq(pactMembers.userId, habitLogs.userId)),
      )
      .where(and(visibleInPact, after?.data ? lt(habitLogs.id, after.data) : undefined))
      .orderBy(desc(habitLogs.id))
      .limit(PAGE + 1);

    const page = rows.slice(0, PAGE);
    const ids = page.map((r) => r.logId);
    const reacts = ids.length
      ? await this.db
          .select({ logId: reactions.logId, emoji: reactions.emoji, userId: reactions.userId })
          .from(reactions)
          .where(inArray(reactions.logId, ids))
      : [];

    const items: FeedItem[] = page.map((r) => {
      const mine = reacts.filter((x) => x.logId === r.logId);
      const byEmoji = new Map<string, { count: number; mine: boolean }>();
      for (const x of mine) {
        const e = byEmoji.get(x.emoji) ?? { count: 0, mine: false };
        e.count++;
        if (x.userId === userId) e.mine = true;
        byEmoji.set(x.emoji, e);
      }
      return {
        logId: r.logId,
        user: { id: r.userId, displayName: r.displayName },
        habit: { id: r.habitId, title: r.title, identity: r.identity, kind: r.kind },
        status: r.status,
        localDate: r.localDate,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
        reactions: [...byEmoji].map(([emoji, v]) => ({ emoji, ...v })),
      };
    });
    const last = page.at(-1);
    return {
      items,
      nextCursor: rows.length > PAGE && last ? last.logId : null,
    };
  }

  /** El registro debe estar en un pacto compartido con el usuario y ser visible para él. */
  private async visibleLog(userId: string, logId: string) {
    const [row] = await this.db
      .select({ ownerId: habitLogs.userId, title: habits.title })
      .from(habitLogs)
      .innerJoin(habits, eq(habits.id, habitLogs.habitId))
      .innerJoin(pactHabits, eq(pactHabits.habitId, habitLogs.habitId))
      .innerJoin(
        pactMembers,
        and(eq(pactMembers.pactId, pactHabits.pactId), eq(pactMembers.userId, userId)),
      )
      .where(and(eq(habitLogs.id, logId), visibleInPact))
      .limit(1);
    if (!row) throw notFound('Registro');
    return row;
  }

  async react(userId: string, logId: string, emoji: string) {
    const log = await this.visibleLog(userId, logId);
    const inserted = await this.db
      .insert(reactions)
      .values({ logId, userId, emoji })
      .onConflictDoNothing()
      .returning();
    if (inserted.length && log.ownerId !== userId) {
      const [me] = await this.db
        .select({ name: users.displayName })
        .from(users)
        .where(eq(users.id, userId));
      await this.notifications.notify(log.ownerId, 'reaction', {
        title: `${me?.name ?? 'Alguien'} reaccionó ${emoji}`,
        body: `A tu registro de "${log.title}"`,
        url: '/hoy',
      });
      // Las reacciones llegan al push agrupadas: "Ana y 2 más reaccionaron".
      await this.jobs.scheduleOnce(
        'reaction_digest',
        new Date(Date.now() + REACTION_DIGEST_DELAY_MS),
        { userId: log.ownerId, since: new Date().toISOString() },
        `reactions:${log.ownerId}`,
      );
      if ((await this.gamification.countReactionsGiven(userId)) >= 10) {
        await this.gamification.unlock(userId, 'cheerleader');
      }
    }
    return { ok: true };
  }

  async unreact(userId: string, logId: string, emoji: string) {
    await this.db
      .delete(reactions)
      .where(
        and(eq(reactions.logId, logId), eq(reactions.userId, userId), eq(reactions.emoji, emoji)),
      );
    return { ok: true };
  }

  /** Empujón amable: uno por día y hábito, solo entre miembros de un mismo pacto. */
  async nudge(fromUserId: string, input: NudgeInput) {
    if (input.toUserId === fromUserId)
      throw badRequest('self_nudge', 'No puedes empujarte a ti mismo');
    const [target] = await this.db
      .select({ habitId: habits.id, title: habits.title, tz: users.timezone })
      .from(habits)
      .innerJoin(users, eq(users.id, habits.userId))
      .innerJoin(pactHabits, eq(pactHabits.habitId, habits.id))
      .innerJoin(
        pactMembers,
        and(eq(pactMembers.pactId, pactHabits.pactId), eq(pactMembers.userId, fromUserId)),
      )
      .where(
        and(
          eq(habits.id, input.habitId),
          eq(habits.userId, input.toUserId),
          isNull(habits.archivedAt),
          ne(habits.visibility, 'private'),
        ),
      )
      .limit(1);
    if (!target) throw notFound('Hábito');

    const today = localToday(target.tz);
    const [done] = await this.db
      .select({ id: habitLogs.id })
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, input.habitId), eq(habitLogs.localDate, today)));
    if (done) throw conflict('already_done', 'Ya lo registró hoy. ¡Mejor reacciona!');

    const inserted = await this.db
      .insert(nudges)
      .values({
        fromUser: fromUserId,
        toUser: input.toUserId,
        habitId: input.habitId,
        localDate: today,
        message: input.message,
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length)
      throw conflict('already_nudged', 'Ya le enviaste un empujón hoy por este hábito');

    const [me] = await this.db
      .select({ name: users.displayName })
      .from(users)
      .where(eq(users.id, fromUserId));
    await this.notifications.notify(input.toUserId, 'nudge', {
      title: `${me?.name ?? 'Un amigo'}: ${NUDGE_MESSAGES[input.message]}`,
      body: `Tu hábito "${target.title}" te espera.`,
      url: '/hoy',
      push: {
        habitId: input.habitId,
        actions: [
          { action: 'done', title: 'Hecho' },
          { action: 'min', title: 'Versión de 2 min' },
        ],
      },
    });
    return { ok: true };
  }

  /** Resumen agrupado de reacciones recibidas desde `since`. */
  async reactionDigest(userId: string, since: Date) {
    const rows = await this.db
      .select({ name: users.displayName, userId: reactions.userId })
      .from(reactions)
      .innerJoin(habitLogs, eq(habitLogs.id, reactions.logId))
      .innerJoin(users, eq(users.id, reactions.userId))
      .where(
        and(
          eq(habitLogs.userId, userId),
          ne(reactions.userId, userId),
          sql`${reactions.createdAt} >= ${since.toISOString()}::timestamptz`,
        ),
      );
    const names = [...new Map(rows.map((r) => [r.userId, r.name])).values()];
    if (!names.length) return false;
    const body =
      names.length === 1
        ? `${names[0]} reaccionó a tu registro`
        : `${names[0]} y ${names.length - 1} más reaccionaron`;
    return this.notifications.pushOnly(userId, 'reaction', {
      title: 'Tu pacto te celebra',
      body,
      url: '/hoy',
      tag: 'reaction',
    });
  }
}
