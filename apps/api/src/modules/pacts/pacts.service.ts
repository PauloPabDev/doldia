import { randomInt } from 'node:crypto';
import {
  type createPactInput,
  type InvitePreview,
  PACT_MAX_MEMBERS,
  type Pact,
  type updatePactInput,
} from '@habitos/contracts';
import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, gte, inArray, isNull, ne } from 'drizzle-orm';
import type { z } from 'zod';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import { addDays, diffDays, localToday } from '../../common/time';
import type { Db } from '../../db/client';
import { InjectDb } from '../../db/db.module';
import { habitLogs, habits, pactHabits, pactMembers, pacts, users } from '../../db/schema';
import { GamificationService, weekStart } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';

// Sin caracteres ambiguos (0/O, 1/I/L) para que el código se pueda dictar.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function inviteCode(length = 8) {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

const COUNTED = ['done', 'min', 'skip'] as const;

@Injectable()
export class PactsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly notifications: NotificationsService,
    private readonly gamification: GamificationService,
  ) {}

  private async userTz(userId: string) {
    const [u] = await this.db
      .select({ tz: users.timezone })
      .from(users)
      .where(eq(users.id, userId));
    return u?.tz ?? 'UTC';
  }

  async create(userId: string, input: z.output<typeof createPactInput>): Promise<Pact> {
    const today = localToday(await this.userTz(userId));
    const pact = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(pacts)
        .values({
          name: input.name,
          goal: input.goal,
          accent: input.accent,
          monthlyTarget: input.monthlyTarget,
          startsAt: today,
          endsAt: input.endsAt,
          inviteCode: inviteCode(),
          createdBy: userId,
        })
        .returning();
      if (!row) throw new Error('No se pudo crear el pacto');
      await tx.insert(pactMembers).values({ pactId: row.id, userId, role: 'owner' });
      return row;
    });
    if (input.habitIds.length) await this.shareHabits(userId, pact.id, input.habitIds);
    await this.gamification.unlock(userId, 'first_pact');
    return this.detail(userId, pact.id);
  }

  async list(userId: string): Promise<Pact[]> {
    const rows = await this.db
      .select({ pactId: pactMembers.pactId })
      .from(pactMembers)
      .where(eq(pactMembers.userId, userId))
      .orderBy(asc(pactMembers.joinedAt));
    return Promise.all(rows.map((r) => this.detail(userId, r.pactId)));
  }

  async detail(userId: string, pactId: string, now = new Date()): Promise<Pact> {
    const [pact] = await this.db.select().from(pacts).where(eq(pacts.id, pactId));
    if (!pact) throw notFound('Pacto');
    const members = await this.db
      .select({
        userId: pactMembers.userId,
        role: pactMembers.role,
        joinedAt: pactMembers.joinedAt,
        displayName: users.displayName,
        timezone: users.timezone,
      })
      .from(pactMembers)
      .innerJoin(users, eq(users.id, pactMembers.userId))
      .where(eq(pactMembers.pactId, pactId))
      .orderBy(asc(pactMembers.joinedAt));
    const me = members.find((m) => m.userId === userId);
    if (!me) throw notFound('Pacto');

    const shared = await this.db
      .select({ habitId: pactHabits.habitId, userId: habits.userId, title: habits.title })
      .from(pactHabits)
      .innerJoin(habits, eq(habits.id, pactHabits.habitId))
      .where(and(eq(pactHabits.pactId, pactId), isNull(habits.archivedAt)));
    const habitIds = shared.map((s) => s.habitId);

    const today = localToday(me.timezone, now);
    const since = addDays(today, -90);
    const logs = habitIds.length
      ? await this.db
          .select({
            habitId: habitLogs.habitId,
            userId: habitLogs.userId,
            localDate: habitLogs.localDate,
            status: habitLogs.status,
          })
          .from(habitLogs)
          .where(
            and(
              inArray(habitLogs.habitId, habitIds),
              gte(habitLogs.localDate, since),
              inArray(habitLogs.status, [...COUNTED]),
            ),
          )
      : [];

    const daysBy = new Map<string, Set<string>>();
    for (const l of logs) {
      let set = daysBy.get(l.userId);
      if (!set) {
        set = new Set();
        daysBy.set(l.userId, set);
      }
      set.add(l.localDate);
    }

    const memberToday = (m: (typeof members)[number]) => localToday(m.timezone, now);
    const groupStreak = this.groupStreak(
      members.map((m) => ({
        days: daysBy.get(m.userId) ?? new Set<string>(),
        joined: localToday(m.timezone, m.joinedAt),
      })),
      today,
    );

    const monthStart = `${today.slice(0, 7)}-01`;
    const votes = logs.filter((l) => l.status !== 'skip');
    const monthlyCount = votes.filter((l) => l.localDate >= monthStart).length;
    const weekVotes = votes.filter((l) => l.localDate >= weekStart(today)).length;
    const garden = Math.min(1, weekVotes / Math.max(1, members.length * 7));

    return {
      id: pact.id,
      name: pact.name,
      goal: pact.goal,
      accent: pact.accent,
      startsAt: pact.startsAt,
      endsAt: pact.endsAt,
      monthlyTarget: pact.monthlyTarget,
      inviteCode: pact.inviteCode,
      members: members.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        role: m.role,
        loggedToday: daysBy.get(m.userId)?.has(memberToday(m)) ?? false,
        joinedAt: m.joinedAt.toISOString(),
        habits: shared
          .filter((s) => s.userId === m.userId)
          .map((s) => ({
            id: s.habitId,
            title: s.title,
            loggedToday: logs.some(
              (l) => l.habitId === s.habitId && l.localDate === memberToday(m),
            ),
          })),
      })),
      groupStreak,
      monthlyCount,
      garden: Math.round(garden * 100) / 100,
      myHabitIds: shared.filter((s) => s.userId === userId).map((s) => s.habitId),
    };
  }

  /**
   * Días seguidos en que todos los miembros registraron algo. Hoy sigue abierto:
   * si alguien aún no registra, se cuenta hasta ayer.
   */
  groupStreak(members: Array<{ days: Set<string>; joined: string }>, today: string) {
    if (!members.length) return 0;
    const complete = (day: string) =>
      members.every((m) => diffDays(day, m.joined) < 0 || m.days.has(day)) &&
      members.some((m) => m.days.has(day));
    let day = complete(today) ? today : addDays(today, -1);
    let streak = 0;
    while (complete(day) && streak < 90) {
      streak++;
      day = addDays(day, -1);
    }
    return streak;
  }

  async update(userId: string, pactId: string, input: z.output<typeof updatePactInput>) {
    await this.assertOwner(userId, pactId);
    await this.db.update(pacts).set(input).where(eq(pacts.id, pactId));
    return this.detail(userId, pactId);
  }

  async rotateInvite(userId: string, pactId: string, revoke = false) {
    await this.assertOwner(userId, pactId);
    await this.db
      .update(pacts)
      .set({ inviteCode: revoke ? null : inviteCode() })
      .where(eq(pacts.id, pactId));
    return this.detail(userId, pactId);
  }

  async preview(code: string): Promise<InvitePreview> {
    const [pact] = await this.db
      .select()
      .from(pacts)
      .where(eq(pacts.inviteCode, code.toUpperCase()));
    if (!pact) throw notFound('Invitación');
    const members = await this.db
      .select({ name: users.displayName, userId: users.id })
      .from(pactMembers)
      .innerJoin(users, eq(users.id, pactMembers.userId))
      .where(eq(pactMembers.pactId, pact.id))
      .orderBy(asc(pactMembers.joinedAt));
    const inviter = members.find((m) => m.userId === pact.createdBy) ?? members[0];
    return {
      pactId: pact.id,
      name: pact.name,
      goal: pact.goal,
      accent: pact.accent,
      invitedBy: inviter?.name ?? '',
      memberCount: members.length,
      members: members.map((m) => m.name),
      full: members.length >= PACT_MAX_MEMBERS,
    };
  }

  async join(userId: string, code: string, habitIds: string[] = []) {
    const [pact] = await this.db
      .select()
      .from(pacts)
      .where(eq(pacts.inviteCode, code.toUpperCase()));
    if (!pact) throw notFound('Invitación');

    const joined = await this.db.transaction(async (tx) => {
      // Bloquea el pacto para que dos personas no ocupen el último cupo a la vez.
      await tx.select({ id: pacts.id }).from(pacts).where(eq(pacts.id, pact.id)).for('update');
      const [already] = await tx
        .select()
        .from(pactMembers)
        .where(and(eq(pactMembers.pactId, pact.id), eq(pactMembers.userId, userId)));
      if (already) return false;
      const [n] = await tx
        .select({ n: count() })
        .from(pactMembers)
        .where(eq(pactMembers.pactId, pact.id));
      if ((n?.n ?? 0) >= PACT_MAX_MEMBERS) {
        throw conflict('pact_full', `Este pacto ya tiene ${PACT_MAX_MEMBERS} miembros`);
      }
      await tx
        .insert(pactMembers)
        .values({ pactId: pact.id, userId, role: 'member', invitedBy: pact.createdBy });
      return true;
    });

    if (habitIds.length) await this.shareHabits(userId, pact.id, habitIds);
    if (joined) {
      await this.gamification.unlock(userId, 'first_pact');
      const [me] = await this.db
        .select({ name: users.displayName })
        .from(users)
        .where(eq(users.id, userId));
      const others = await this.db
        .select({ userId: pactMembers.userId })
        .from(pactMembers)
        .where(and(eq(pactMembers.pactId, pact.id), ne(pactMembers.userId, userId)));
      await Promise.all(
        others.map((o) =>
          this.notifications.notify(o.userId, 'pact_member', {
            title: `${me?.name ?? 'Alguien'} se unió a ${pact.name}`,
            body: 'Dale la bienvenida reaccionando a su primer registro.',
            url: `/pactos/${pact.id}`,
          }),
        ),
      );
    }
    return this.detail(userId, pact.id);
  }

  async leave(userId: string, pactId: string) {
    await this.db.transaction(async (tx) => {
      const mine = await tx
        .select({ habitId: habits.id })
        .from(habits)
        .where(eq(habits.userId, userId));
      if (mine.length) {
        await tx.delete(pactHabits).where(
          and(
            eq(pactHabits.pactId, pactId),
            inArray(
              pactHabits.habitId,
              mine.map((m) => m.habitId),
            ),
          ),
        );
      }
      const [removed] = await tx
        .delete(pactMembers)
        .where(and(eq(pactMembers.pactId, pactId), eq(pactMembers.userId, userId)))
        .returning();
      const rest = await tx
        .select()
        .from(pactMembers)
        .where(eq(pactMembers.pactId, pactId))
        .orderBy(asc(pactMembers.joinedAt));
      if (!rest.length) {
        await tx.delete(pacts).where(eq(pacts.id, pactId));
      } else if (removed?.role === 'owner' && rest[0]) {
        // El pacto no se queda sin dueño: pasa al miembro más antiguo.
        await tx
          .update(pactMembers)
          .set({ role: 'owner' })
          .where(and(eq(pactMembers.pactId, pactId), eq(pactMembers.userId, rest[0].userId)));
      }
    });
  }

  /** Reemplaza los hábitos que el usuario comparte en el pacto. */
  async shareHabits(userId: string, pactId: string, habitIds: string[]) {
    const unique = [...new Set(habitIds)];
    if (unique.length) {
      const owned = await this.db
        .select({ id: habits.id })
        .from(habits)
        .where(
          and(inArray(habits.id, unique), eq(habits.userId, userId), isNull(habits.archivedAt)),
        );
      if (owned.length !== unique.length)
        throw badRequest('invalid_habits', 'Solo puedes compartir tus hábitos');
    }
    const mine = await this.db
      .select({ id: habits.id })
      .from(habits)
      .where(eq(habits.userId, userId));
    await this.db.transaction(async (tx) => {
      if (mine.length) {
        await tx.delete(pactHabits).where(
          and(
            eq(pactHabits.pactId, pactId),
            inArray(
              pactHabits.habitId,
              mine.map((m) => m.id),
            ),
          ),
        );
      }
      if (unique.length) {
        await tx.insert(pactHabits).values(unique.map((habitId) => ({ pactId, habitId })));
        // Compartir un hábito privado lo vuelve visible para el pacto.
        await tx
          .update(habits)
          .set({ visibility: 'pact' })
          .where(and(inArray(habits.id, unique), eq(habits.visibility, 'private')));
      }
    });
    return this.detail(userId, pactId);
  }

  private async assertOwner(userId: string, pactId: string) {
    const [m] = await this.db
      .select({ role: pactMembers.role })
      .from(pactMembers)
      .where(and(eq(pactMembers.pactId, pactId), eq(pactMembers.userId, userId)));
    if (m?.role !== 'owner') throw forbidden('Solo quien creó el pacto puede hacer esto');
  }
}
