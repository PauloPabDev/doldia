import { createPactInput, shareHabitsInput, updatePactInput } from '@habitos/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Public, RateLimit } from '../../common/decorators';
import { PactMemberGuard } from '../../common/ownership.guards';
import type { AuthUser } from '../../common/request';
import { ZodPipe } from '../../common/zod.pipe';
import { PactsService } from './pacts.service';

const code = z.string().regex(/^[A-Za-z0-9]{6,12}$/, 'Código de invitación inválido');
const joinBody = z.object({ habitIds: z.array(z.uuid()).max(10).default([]) });

@Controller('pacts')
export class PactsController {
  constructor(private readonly pacts: PactsService) {}

  /** Vista previa pública: quien llega por el enlace ve el pacto y quién lo invitó. */
  @Public()
  @Get('invite/:code')
  @RateLimit({ name: 'invite', limit: 30, windowMs: 60_000, by: ['ip'] })
  preview(@Param('code', new ZodPipe(code)) c: string) {
    return this.pacts.preview(c);
  }

  @Post('join/:code')
  @HttpCode(200)
  @RateLimit({ name: 'join', limit: 10, windowMs: 60_000, by: ['user'] })
  join(
    @CurrentUser() user: AuthUser,
    @Param('code', new ZodPipe(code)) c: string,
    @Body(new ZodPipe(joinBody)) body: z.output<typeof joinBody>,
  ) {
    return this.pacts.join(user.id, c, body.habitIds);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.pacts.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createPactInput)) body: z.output<typeof createPactInput>,
  ) {
    return this.pacts.create(user.id, body);
  }

  @Get(':pactId')
  @UseGuards(PactMemberGuard)
  detail(@CurrentUser() user: AuthUser, @Param('pactId') pactId: string) {
    return this.pacts.detail(user.id, pactId);
  }

  @Patch(':pactId')
  @UseGuards(PactMemberGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Param('pactId') pactId: string,
    @Body(new ZodPipe(updatePactInput)) body: z.output<typeof updatePactInput>,
  ) {
    return this.pacts.update(user.id, pactId, body);
  }

  @Post(':pactId/invite')
  @UseGuards(PactMemberGuard)
  @HttpCode(200)
  rotateInvite(@CurrentUser() user: AuthUser, @Param('pactId') pactId: string) {
    return this.pacts.rotateInvite(user.id, pactId);
  }

  @Delete(':pactId/invite')
  @UseGuards(PactMemberGuard)
  @HttpCode(200)
  revokeInvite(@CurrentUser() user: AuthUser, @Param('pactId') pactId: string) {
    return this.pacts.rotateInvite(user.id, pactId, true);
  }

  @Put(':pactId/habits')
  @UseGuards(PactMemberGuard)
  share(
    @CurrentUser() user: AuthUser,
    @Param('pactId') pactId: string,
    @Body(new ZodPipe(shareHabitsInput)) body: z.output<typeof shareHabitsInput>,
  ) {
    return this.pacts.shareHabits(user.id, pactId, body.habitIds);
  }

  @Delete(':pactId/members/me')
  @UseGuards(PactMemberGuard)
  @HttpCode(200)
  async leave(@CurrentUser() user: AuthUser, @Param('pactId') pactId: string) {
    await this.pacts.leave(user.id, pactId);
    return { ok: true };
  }
}
