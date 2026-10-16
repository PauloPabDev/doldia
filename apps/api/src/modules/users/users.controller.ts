import { updateMeInput } from '@habitos/contracts';
import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser } from '../../common/decorators';
import type { AuthUser } from '../../common/request';
import { ZodPipe } from '../../common/zod.pipe';
import { HabitsService } from '../habits/habits.service';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly habits: HabitsService,
  ) {}

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.id);
  }

  @Patch()
  async update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateMeInput)) body: z.output<typeof updateMeInput>,
  ) {
    const me = await this.users.updateMe(user.id, body);
    if (body.timezone) await this.habits.rescheduleAll(user.id);
    return me;
  }
}
