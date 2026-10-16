import { Global, Module } from '@nestjs/common';
import { NotificationStream } from './notification-stream';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationStream, NotificationsService, PushService],
  exports: [NotificationsService, PushService, NotificationStream],
})
export class NotificationsModule {}
