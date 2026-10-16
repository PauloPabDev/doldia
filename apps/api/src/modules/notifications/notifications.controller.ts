import { markReadInput, pushSubscribeInput, pushUnsubscribeInput } from '@habitos/contracts';
import { Body, Controller, Get, HttpCode, MessageEvent, Post, Req, Sse } from '@nestjs/common';
import { finalize, interval, map, merge, Observable, of } from 'rxjs';
import type { z } from 'zod';
import { CurrentUser } from '../../common/decorators';
import type { AppRequest, AuthUser } from '../../common/request';
import { ZodPipe } from '../../common/zod.pipe';
import { NotificationStream } from './notification-stream';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

@Controller()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly stream: NotificationStream,
    private readonly push: PushService,
  ) {}

  @Get('notifications')
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  @Post('notifications/read')
  @HttpCode(200)
  read(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(markReadInput)) body: z.output<typeof markReadInput>,
  ) {
    return this.notifications.markRead(user.id, body.ids);
  }

  /** Tiempo real con SSE nativo de Nest; el front abre un EventSource. */
  @Sse('notifications/stream')
  async streamEvents(@CurrentUser() user: AuthUser): Promise<Observable<MessageEvent>> {
    const unread = await this.notifications.unreadCount(user.id);
    const { subject, close } = this.stream.open(user.id);
    return merge(
      of<MessageEvent>({ type: 'unread', data: { unread } }),
      subject.pipe(map((e): MessageEvent => ({ type: e.type, data: e.data }))),
      // Latido para que proxies y navegadores no cierren la conexión inactiva.
      interval(25_000).pipe(map((): MessageEvent => ({ type: 'ping', data: {} }))),
    ).pipe(finalize(close));
  }

  @Get('push/vapid-key')
  vapidKey() {
    return { publicKey: this.push.publicKey() };
  }

  @Post('push/subscribe')
  @HttpCode(200)
  async subscribe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(pushSubscribeInput)) body: z.output<typeof pushSubscribeInput>,
    @Req() req: AppRequest,
  ) {
    await this.notifications.subscribe(user.id, body, req.headers['user-agent']);
    return { ok: true };
  }

  @Post('push/unsubscribe')
  @HttpCode(200)
  async unsubscribe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(pushUnsubscribeInput)) body: z.output<typeof pushUnsubscribeInput>,
  ) {
    await this.notifications.unsubscribe(user.id, body.endpoint);
    return { ok: true };
  }
}
