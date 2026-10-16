import { Injectable, Logger } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import webpush from 'web-push';
import { loadEnv } from '../../config';
import type { Db } from '../../db/client';
import { InjectDb } from '../../db/db.module';
import { pushSubscriptions } from '../../db/schema';

export interface PushPayload {
  title: string;
  body: string;
  url?: string | null;
  tag?: string;
  habitId?: string;
  /** Acciones rápidas desde la notificación: "Hecho" y "Versión de 2 min". */
  actions?: Array<{ action: string; title: string }>;
}

/** Permite sustituir el envío real en pruebas. */
export type PushSender = (
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
) => Promise<{ statusCode: number }>;

@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');
  private sender: PushSender;

  constructor(@InjectDb() private readonly db: Db) {
    const env = loadEnv();
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    this.sender = (sub, payload) =>
      webpush.sendNotification(sub, payload, { TTL: 60 * 60, urgency: 'normal' });
  }

  useSender(sender: PushSender) {
    this.sender = sender;
  }

  publicKey() {
    return loadEnv().VAPID_PUBLIC_KEY;
  }

  /** Envía a todos los dispositivos; borra las suscripciones que respondan 404 o 410. */
  async send(userId: string, payload: PushPayload): Promise<number> {
    const subs = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    if (!subs.length) return 0;
    const body = JSON.stringify(payload);
    const gone: string[] = [];
    let delivered = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await this.sender(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
          delivered++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.id);
          else this.logger.warn(`Push falló (${status ?? 'sin estado'}) para ${s.id}`);
        }
      }),
    );
    if (gone.length)
      await this.db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    return delivered;
  }
}
