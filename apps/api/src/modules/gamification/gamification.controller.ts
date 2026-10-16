import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import type { AuthUser } from '../../common/request';
import { GamificationService } from './gamification.service';

@Controller('me/progress')
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get()
  progress(@CurrentUser() user: AuthUser) {
    return this.gamification.progress(user.id);
  }
}
