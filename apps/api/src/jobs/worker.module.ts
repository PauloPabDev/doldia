import { Module } from '@nestjs/common';
import { FeedModule } from '../modules/feed/feed.module';
import { HabitsModule } from '../modules/habits/habits.module';
import { WorkerService } from './worker.service';

@Module({
  imports: [HabitsModule, FeedModule],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
