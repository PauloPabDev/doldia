import type { AppNotification } from '@habitos/contracts';
import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type StreamEvent =
  | { type: 'notification'; data: AppNotification }
  | { type: 'unread'; data: { unread: number } };

/**
 * Canales SSE en memoria, uno por conexión abierta. Con varias instancias
 * de la API habría que difundir con LISTEN/NOTIFY de Postgres.
 */
@Injectable()
export class NotificationStream {
  private readonly channels = new Map<string, Set<Subject<StreamEvent>>>();

  open(userId: string) {
    const subject = new Subject<StreamEvent>();
    let set = this.channels.get(userId);
    if (!set) {
      set = new Set();
      this.channels.set(userId, set);
    }
    set.add(subject);
    return {
      subject,
      close: () => {
        set.delete(subject);
        if (!set.size) this.channels.delete(userId);
        subject.complete();
      },
    };
  }

  emit(userId: string, event: StreamEvent) {
    for (const subject of this.channels.get(userId) ?? []) subject.next(event);
  }

  connections(userId: string) {
    return this.channels.get(userId)?.size ?? 0;
  }
}
