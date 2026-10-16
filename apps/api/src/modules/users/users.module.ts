import { Module } from '@nestjs/common';
import { HabitsModule } from '../habits/habits.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [HabitsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
