import { DEFAULT_NOTIFICATION_PREFS, type Me, type updateMeInput } from '@habitos/contracts';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import { notFound } from '../../common/errors';
import type { Db } from '../../db/client';
import { InjectDb } from '../../db/db.module';
import { users } from '../../db/schema';

type UserRow = typeof users.$inferSelect;

export function toMe(u: UserRow): Me {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    timezone: u.timezone,
    quietStart: u.quietStart,
    quietEnd: u.quietEnd,
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, ...u.notificationPrefs },
    onboarded: u.onboarded,
    calmMode: u.calmMode,
    createdAt: u.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(@InjectDb() private readonly db: Db) {}

  async findById(id: string) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, id) });
    if (!user) throw notFound('Usuario');
    return user;
  }

  async getMe(id: string): Promise<Me> {
    return toMe(await this.findById(id));
  }

  async updateMe(id: string, input: z.output<typeof updateMeInput>): Promise<Me> {
    const current = await this.findById(id);
    const { notificationPrefs, ...rest } = input;
    const [row] = await this.db
      .update(users)
      .set({
        ...rest,
        ...(notificationPrefs
          ? { notificationPrefs: { ...current.notificationPrefs, ...notificationPrefs } }
          : {}),
      })
      .where(eq(users.id, id))
      .returning();
    if (!row) throw notFound('Usuario');
    return toMe(row);
  }
}
