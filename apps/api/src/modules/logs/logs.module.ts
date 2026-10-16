import { Module } from '@nestjs/common';
import { HabitsModule } from '../habits/habits.module';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';

@Module({
  imports: [HabitsModule],
  controllers: [LogsController],
  providers: [LogsService],
})
export class LogsModule {}
