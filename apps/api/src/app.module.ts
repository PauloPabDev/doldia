import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard, CsrfGuard, RateLimitGuard } from './common/guards';
import { RateLimiter } from './common/rate-limiter';
import { DbModule } from './db/db.module';
import { JobsModule } from './jobs/jobs.module';
import { WorkerModule } from './jobs/worker.module';
import { AuthModule } from './modules/auth/auth.module';
import { FeedModule } from './modules/feed/feed.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { HabitsModule } from './modules/habits/habits.module';
import { HealthController } from './modules/health/health.controller';
import { LogsModule } from './modules/logs/logs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PactsModule } from './modules/pacts/pacts.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    DbModule,
    JobsModule,
    NotificationsModule,
    GamificationModule,
    AuthModule,
    UsersModule,
    HabitsModule,
    LogsModule,
    PactsModule,
    FeedModule,
    WorkerModule,
  ],
  controllers: [HealthController],
  providers: [
    RateLimiter,
    // El orden importa: primero se identifica al usuario, luego CSRF y límites.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}
