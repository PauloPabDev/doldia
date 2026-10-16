import { Module } from '@nestjs/common';
import { PactsController } from './pacts.controller';
import { PactsService } from './pacts.service';

@Module({
  controllers: [PactsController],
  providers: [PactsService],
  exports: [PactsService],
})
export class PactsModule {}
