import { nudgeInput, reactionEmoji, reactionInput } from '@habitos/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, RateLimit } from '../../common/decorators';
import { PactMemberGuard } from '../../common/ownership.guards';
import type { AuthUser } from '../../common/request';
import { ZodPipe } from '../../common/zod.pipe';
import { FeedService } from './feed.service';

@Controller()
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('pacts/:pactId/feed')
  @UseGuards(PactMemberGuard)
  list(
    @CurrentUser() user: AuthUser,
    @Param('pactId') pactId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.feed.feed(user.id, pactId, cursor);
  }

  @Post('logs/:logId/reactions')
  @HttpCode(200)
  @RateLimit({ name: 'react', limit: 60, windowMs: 60_000, by: ['user'] })
  react(
    @CurrentUser() user: AuthUser,
    @Param('logId', new ParseUUIDPipe()) logId: string,
    @Body(new ZodPipe(reactionInput)) body: z.output<typeof reactionInput>,
  ) {
    return this.feed.react(user.id, logId, body.emoji);
  }

  @Delete('logs/:logId/reactions/:emoji')
  @HttpCode(200)
  unreact(
    @CurrentUser() user: AuthUser,
    @Param('logId', new ParseUUIDPipe()) logId: string,
    @Param('emoji', new ZodPipe(reactionEmoji)) emoji: string,
  ) {
    return this.feed.unreact(user.id, logId, emoji);
  }

  @Post('nudges')
  @HttpCode(200)
  @RateLimit({ name: 'nudge', limit: 20, windowMs: 60 * 60_000, by: ['user'] })
  nudge(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(nudgeInput)) body: z.output<typeof nudgeInput>,
  ) {
    return this.feed.nudge(user.id, body);
  }
}
