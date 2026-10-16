import { createHabitInput, updateHabitInput } from '@habitos/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser } from '../../common/decorators';
import { HabitOwnerGuard } from '../../common/ownership.guards';
import type { AuthUser } from '../../common/request';
import { ZodPipe } from '../../common/zod.pipe';
import { HabitsService } from './habits.service';

@Controller()
export class HabitsController {
  constructor(private readonly habits: HabitsService) {}

  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.habits.today(user.id);
  }

  @Get('habits')
  list(@CurrentUser() user: AuthUser) {
    return this.habits.list(user.id);
  }

  @Post('habits')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createHabitInput)) body: z.output<typeof createHabitInput>,
  ) {
    return this.habits.create(user.id, body);
  }

  @Get('habits/:habitId')
  @UseGuards(HabitOwnerGuard)
  detail(@CurrentUser() user: AuthUser, @Param('habitId') habitId: string) {
    return this.habits.detail(user.id, habitId);
  }

  @Patch('habits/:habitId')
  @UseGuards(HabitOwnerGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Param('habitId') habitId: string,
    @Body(new ZodPipe(updateHabitInput)) body: z.output<typeof updateHabitInput>,
  ) {
    return this.habits.update(user.id, habitId, body);
  }

  @Delete('habits/:habitId')
  @UseGuards(HabitOwnerGuard)
  @HttpCode(200)
  async archive(@CurrentUser() user: AuthUser, @Param('habitId') habitId: string) {
    await this.habits.archive(user.id, habitId);
    return { ok: true };
  }
}
