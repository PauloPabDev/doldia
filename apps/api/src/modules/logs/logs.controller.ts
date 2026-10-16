import { createLogInput, localDate, syncLogsInput } from '@habitos/contracts';
import { Body, Controller, Delete, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser } from '../../common/decorators';
import { HabitOwnerGuard } from '../../common/ownership.guards';
import type { AuthUser } from '../../common/request';
import { ZodPipe } from '../../common/zod.pipe';
import { LogsService } from './logs.service';

@Controller()
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Post('habits/:habitId/logs')
  @UseGuards(HabitOwnerGuard)
  create(
    @CurrentUser() user: AuthUser,
    @Param('habitId') habitId: string,
    @Body(new ZodPipe(createLogInput)) body: z.output<typeof createLogInput>,
  ) {
    return this.logs.create(user.id, habitId, body);
  }

  @Delete('habits/:habitId/logs/:localDate')
  @UseGuards(HabitOwnerGuard)
  @HttpCode(200)
  undo(
    @CurrentUser() user: AuthUser,
    @Param('habitId') habitId: string,
    @Param('localDate', new ZodPipe(localDate)) date: string,
  ) {
    return this.logs.undo(user.id, habitId, date);
  }

  /** Lote de la cola offline; client_id evita duplicados. */
  @Post('logs/sync')
  @HttpCode(200)
  sync(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(syncLogsInput)) body: z.output<typeof syncLogsInput>,
  ) {
    return this.logs.sync(user.id, body);
  }
}
