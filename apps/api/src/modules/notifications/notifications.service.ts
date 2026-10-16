import {
  type AppNotification,
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationType,
  type PushSubscribeInput,
} from '@habitos/contracts';
import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { inQuietHours, localToday, zonedParts, zonedToUtc } from '../../common/time';
import type { Db } from '../../db/client';
import { InjectDb } from '../../db/db.module';
import { notifications, pushSubscriptions, users } from '../../db/schema';
import { NotificationStream } from './notification-stream';
import { PushPayload, PushService } from './push.service';

export const MAX_PUSH_PER_DAY = 4;

/** Canal por tipo: in-app, push o ambos. Las reacciones van a push agrupadas por un trabajo aparte. */
const CHANNELS: Record<NotificationType, { inApp: boolean; push: boolean }> = {
  reminder: { inApp: false, push: true },
  reaction: { inApp: true, push: false },
  nudge: { inApp: true, push: true },
  pact_member: { inApp: true, push: false },
  streak_risk: { inApp: false, push: true },
  achievement: { inApp: true, push: false },
  weekly_summary: { inApp: true, push: true },
};

export interface NotifyContent {
  title: string;
  body: string;
  url?: string | null;
  push?: Omit<PushPayload, 'title' | 'body' | 'url'>;
}

type NotificationRow = typeof notifications.$inferSelect;

export function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.payload.title,
    body: row.payload.body,
    url: row.payload.url ?? null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Punto único que decide el canal según tipo, preferencias, horario silencioso y límite diario. */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly stream: NotificationStream,
    private readonly push: PushService,
  ) {}

  async notify(userId: string, type: NotificationType, content: NotifyContent, now = new Date()) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return { inApp: false, pushed: false };
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...user.notificationPrefs };
    if (!prefs[type]) return { inApp: false, pushed: false };

    const channel = CHANNELS[type];
    const pushAllowed = channel.push && (await this.canPush(user, type, now));
    // Los avisos solo-push se guardan igual para respetar el límite diario, pero ya leídos.
    const [row] = await this.db
      .insert(notifications)
      .values({
        userId,
        type,
        payload: { title: content.title, body: content.body, url: content.url ?? null },
        readAt: channel.inApp ? null : now,
        createdAt: now,
      })
      .returning();
    if (!row) return { inApp: false, pushed: false };

    if (channel.inApp) {
      this.stream.emit(userId, { type: 'notification', data: toNotification(row) });
      this.stream.emit(userId, {
        type: 'unread',
        data: { unread: await this.unreadCount(userId) },
      });
    }

    let pushed = false;
    if (pushAllowed) {
      const delivered = await this.push.send(userId, {
        title: content.title,
        body: content.body,
        url: content.url ?? '/hoy',
        tag: type,
        ...content.push,
      });
      if (delivered > 0) {
        pushed = true;
        await this.db
          .update(notifications)
          .set({ pushedAt: now })
          .where(eq(notifications.id, row.id));
      }
    }
    return { inApp: channel.inApp, pushed };
  }

  /** Push sin fila de bandeja (resumen agrupado de reacciones). */
  async pushOnly(userId: string, type: NotificationType, payload: PushPayload, now = new Date()) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return false;
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...user.notificationPrefs };
    if (!prefs[type] || !(await this.canPush(user, type, now))) return false;
    const delivered = await this.push.send(userId, payload);
    if (delivered) {
      await this.db.insert(notifications).values({
        userId,
        type,
        payload: { title: payload.title, body: payload.body, url: payload.url ?? null },
        readAt: now,
        pushedAt: now,
        createdAt: now,
      });
    }
    return delivered > 0;
  }

  private async canPush(user: typeof users.$inferSelect, type: NotificationType, now: Date) {
    // Los recordatorios los eligió el usuario: no los frena el horario silencioso ni el tope.
    if (type === 'reminder') return true;
    const parts = zonedParts(now, user.timezone);
    if (inQuietHours(parts, user.quietStart, user.quietEnd)) return false;
    const dayStart = zonedToUtc(localToday(user.timezone, now), '00:00', user.timezone);
    const [row] = await this.db
      .select({ n: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, user.id),
          isNotNull(notifications.pushedAt),
          gte(notifications.pushedAt, dayStart),
          ne(notifications.type, 'reminder'),
        ),
      );
    return (row?.n ?? 0) < MAX_PUSH_PER_DAY;
  }

  async list(userId: string, limit = 30) {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), inArray(notifications.type, this.inAppTypes())))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return { items: rows.map(toNotification), unread: await this.unreadCount(userId) };
  }

  async unreadCount(userId: string) {
    const [row] = await this.db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.n ?? 0;
  }

  async markRead(userId: string, ids?: string[]) {
    const where = ids?.length
      ? and(eq(notifications.userId, userId), inArray(notifications.id, ids))
      : and(eq(notifications.userId, userId), isNull(notifications.readAt));
    await this.db.update(notifications).set({ readAt: new Date() }).where(where);
    const unread = await this.unreadCount(userId);
    this.stream.emit(userId, { type: 'unread', data: { unread } });
    return { unread };
  }

  async subscribe(userId: string, input: PushSubscribeInput, userAgent?: string) {
    await this.db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: userAgent?.slice(0, 300),
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh: input.keys.p256dh, auth: input.keys.auth },
      });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  }

  private inAppTypes() {
    return (Object.keys(CHANNELS) as NotificationType[]).filter((t) => CHANNELS[t].inApp);
  }
}
