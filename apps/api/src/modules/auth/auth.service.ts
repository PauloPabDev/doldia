import { createHash, randomBytes } from 'node:crypto';
import type { changePasswordInput, loginInput, registerInput } from '@habitos/contracts';
import { HttpStatus, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { z } from 'zod';
import { AppError, conflict, unauthorized } from '../../common/errors';
import { uuidv7 } from '../../common/uuid';
import { loadEnv } from '../../config';
import type { Db } from '../../db/client';
import { InjectDb } from '../../db/db.module';
import { auditLog, sessions, users } from '../../db/schema';
import { signJwt } from './jwt';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const REFRESH_RACE_GRACE_MS = 5_000;

export interface ClientInfo {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface IssuedTokens {
  userId: string;
  access: string;
  refresh: string;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  constructor(@InjectDb() private readonly db: Db) {}

  async register(input: z.output<typeof registerInput>, client: ClientInfo): Promise<IssuedTokens> {
    const passwordHash = await hashPassword(input.password);
    const [user] = await this.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        timezone: input.timezone,
      })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (!user) throw conflict('email_taken', 'Ya existe una cuenta con ese correo');
    await this.audit(user.id, 'register', client);
    return this.createSession(user.id, uuidv7(), client);
  }

  async login(input: z.output<typeof loginInput>, client: ClientInfo): Promise<IssuedTokens> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, input.email),
      columns: { id: true, passwordHash: true },
    });
    // Se verifica siempre para no revelar por tiempo si el correo existe.
    const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      await this.audit(user?.id ?? null, 'login_failed', client, { email: input.email });
      throw unauthorized('Correo o contraseña incorrectos');
    }
    await this.audit(user.id, 'login', client);
    return this.createSession(user.id, uuidv7(), client);
  }

  /**
   * Rota el refresh: invalida el anterior y emite uno nuevo de la misma familia.
   * Si llega uno ya usado, se asume robo y se revoca toda la familia.
   */
  async refresh(rawToken: string | undefined, client: ClientInfo): Promise<IssuedTokens> {
    if (!rawToken) throw unauthorized();
    const hash = sha256(rawToken);

    const result = await this.db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(sessions)
        .where(eq(sessions.refreshHash, hash))
        .for('update');
      if (!session) throw unauthorized();
      // Dos pestañas que refrescan a la vez no son un robo: margen corto para esa carrera.
      const raced =
        session.rotatedAt &&
        !session.revokedAt &&
        Date.now() - session.rotatedAt.getTime() < REFRESH_RACE_GRACE_MS;
      if (raced) {
        return {
          kind: 'ok' as const,
          tokens: await this.createSession(session.userId, session.familyId, client, tx),
        };
      }
      if (session.rotatedAt || session.revokedAt)
        return { kind: 'reused' as const, reused: session };
      if (session.expiresAt.getTime() <= Date.now()) throw unauthorized('Tu sesión expiró');

      await tx.update(sessions).set({ rotatedAt: new Date() }).where(eq(sessions.id, session.id));
      return {
        kind: 'ok' as const,
        tokens: await this.createSession(session.userId, session.familyId, client, tx),
      };
    });

    if (result.kind === 'ok') return result.tokens;

    // Reuso detectado: se revoca la familia fuera de la transacción para que no se deshaga al lanzar.
    const { reused } = result;
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.familyId, reused.familyId), isNull(sessions.revokedAt)));
    await this.audit(reused.userId, 'refresh_reuse_detected', client, {
      familyId: reused.familyId,
    });
    throw new AppError(
      HttpStatus.UNAUTHORIZED,
      'session_revoked',
      'Por seguridad cerramos tu sesión. Vuelve a entrar.',
    );
  }

  async logout(sessionId: string | undefined, rawRefresh: string | undefined) {
    const now = new Date();
    if (rawRefresh) {
      const [row] = await this.db
        .select({ familyId: sessions.familyId })
        .from(sessions)
        .where(eq(sessions.refreshHash, sha256(rawRefresh)));
      if (row) {
        await this.db
          .update(sessions)
          .set({ revokedAt: now })
          .where(eq(sessions.familyId, row.familyId));
        return;
      }
    }
    if (sessionId) {
      const [row] = await this.db
        .select({ familyId: sessions.familyId })
        .from(sessions)
        .where(eq(sessions.id, sessionId));
      if (row) {
        await this.db
          .update(sessions)
          .set({ revokedAt: now })
          .where(eq(sessions.familyId, row.familyId));
      }
    }
  }

  async logoutAll(userId: string, client: ClientInfo) {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    await this.audit(userId, 'logout_all', client);
  }

  async changePassword(
    userId: string,
    input: z.output<typeof changePasswordInput>,
    client: ClientInfo,
  ): Promise<IssuedTokens> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { passwordHash: true },
    });
    if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'wrong_password',
        'La contraseña actual no coincide',
      );
    }
    await this.db
      .update(users)
      .set({ passwordHash: await hashPassword(input.newPassword) })
      .where(eq(users.id, userId));
    await this.logoutAll(userId, client);
    await this.audit(userId, 'password_changed', client);
    return this.createSession(userId, uuidv7(), client);
  }

  private async createSession(
    userId: string,
    familyId: string,
    client: ClientInfo,
    tx: Pick<Db, 'insert'> = this.db,
  ): Promise<IssuedTokens> {
    const env = loadEnv();
    const refresh = randomBytes(32).toString('base64url');
    const [session] = await tx
      .insert(sessions)
      .values({
        userId,
        familyId,
        refreshHash: sha256(refresh),
        userAgent: client.userAgent?.slice(0, 300),
        ip: client.ip,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      })
      .returning({ id: sessions.id });
    if (!session) throw new Error('No se pudo crear la sesión');
    const access = signJwt(
      { sub: userId, sid: session.id },
      { secret: env.JWT_SECRET, issuer: env.JWT_ISSUER, ttlSeconds: ACCESS_TTL_SECONDS },
    );
    return { userId, access, refresh };
  }

  private async audit(
    userId: string | null,
    action: string,
    client: ClientInfo,
    meta?: Record<string, unknown>,
  ) {
    await this.db.insert(auditLog).values({
      userId,
      action,
      ip: client.ip,
      userAgent: client.userAgent?.slice(0, 300),
      meta,
    });
  }
}
