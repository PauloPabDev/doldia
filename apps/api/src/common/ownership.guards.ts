import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';
import { habits, pactMembers } from '../db/schema';
import { notFound } from './errors';
import type { AppRequest } from './request';

const uuid = z.uuid();

/**
 * Guard de pertenencia: el hábito debe ser del usuario. Responde 404 (no 403)
 * para no revelar que el recurso existe.
 */
@Injectable()
export class HabitOwnerGuard implements CanActivate {
  constructor(@InjectDb() private readonly db: Db) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const id = req.params.habitId;
    if (!req.user || !uuid.safeParse(id).success) throw notFound('Hábito');
    const [row] = await this.db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, id as string), eq(habits.userId, req.user.id)));
    if (!row) throw notFound('Hábito');
    return true;
  }
}

/** El usuario debe ser miembro del pacto. */
@Injectable()
export class PactMemberGuard implements CanActivate {
  constructor(@InjectDb() private readonly db: Db) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const id = req.params.pactId;
    if (!req.user || !uuid.safeParse(id).success) throw notFound('Pacto');
    const [row] = await this.db
      .select({ role: pactMembers.role })
      .from(pactMembers)
      .where(and(eq(pactMembers.pactId, id as string), eq(pactMembers.userId, req.user.id)));
    if (!row) throw notFound('Pacto');
    return true;
  }
}
