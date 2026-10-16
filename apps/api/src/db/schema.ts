import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from '../common/uuid';

const pk = () =>
  uuid()
    .primaryKey()
    .$defaultFn(() => uuidv7());
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const habitKind = pgEnum('habit_kind', ['build', 'break']);
export const visibility = pgEnum('visibility', ['private', 'pact', 'friends']);
export const logStatus = pgEnum('log_status', ['done', 'min', 'relapse', 'skip']);
export const pactRole = pgEnum('pact_role', ['owner', 'member']);

export const users = pgTable(
  'users',
  {
    id: pk(),
    email: text().notNull(),
    passwordHash: text().notNull(),
    displayName: text().notNull(),
    timezone: text().notNull().default('America/Bogota'),
    quietStart: text().notNull().default('22:00'),
    quietEnd: text().notNull().default('07:00'),
    notificationPrefs: jsonb().$type<Record<string, boolean>>().notNull().default({}),
    onboarded: boolean().notNull().default(false),
    calmMode: boolean().notNull().default(false),
    /** Último día local cerrado por el worker diario (rachas, comodines). */
    lastClosedDate: date(),
    riskNotifiedDate: date(),
    weeklySummaryDate: date(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('users_email_key').on(t.email)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: pk(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid().notNull(),
    refreshHash: text().notNull(),
    userAgent: text(),
    ip: text(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    /** Momento en que este refresh se usó para rotar; si vuelve a llegar es reuso. */
    rotatedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('sessions_refresh_hash_key').on(t.refreshHash),
    index('sessions_family_idx').on(t.familyId),
    index('sessions_user_idx').on(t.userId),
  ],
);

export const habits = pgTable(
  'habits',
  {
    id: pk(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: habitKind().notNull(),
    identity: text().notNull(),
    title: text().notNull(),
    minVersion: text(),
    cueTime: text(),
    cuePlace: text(),
    stackedOn: uuid(),
    visibility: visibility().notNull().default('pact'),
    triggers: jsonb().$type<string[]>().notNull().default([]),
    substitute: text(),
    relapseVisibility: visibility().notNull().default('private'),
    savingsPerDay: real(),
    savingsUnit: text(),
    /** Fecha local de inicio, base del contador de libertad. */
    startDate: date().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('habits_user_idx').on(t.userId)],
);

export const habitLogs = pgTable(
  'habit_logs',
  {
    id: pk(),
    habitId: uuid()
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date().notNull(),
    status: logStatus().notNull(),
    value: real(),
    note: text(),
    photoUrl: text(),
    clientId: uuid().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('habit_logs_habit_date_key').on(t.habitId, t.localDate),
    uniqueIndex('habit_logs_client_key').on(t.userId, t.clientId),
    index('habit_logs_user_date_idx').on(t.userId, t.localDate),
  ],
);

export const streaks = pgTable('streaks', {
  habitId: uuid()
    .primaryKey()
    .references(() => habits.id, { onDelete: 'cascade' }),
  current: integer().notNull().default(0),
  best: integer().notNull().default(0),
  freezesLeft: integer().notNull().default(2),
  lastDate: date(),
});

export const pacts = pgTable(
  'pacts',
  {
    id: pk(),
    name: text().notNull(),
    goal: text(),
    accent: text().notNull().default('#2F6F5E'),
    monthlyTarget: integer().notNull().default(100),
    startsAt: date().notNull(),
    endsAt: date(),
    inviteCode: text(),
    createdBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('pacts_invite_code_key').on(t.inviteCode)],
);

export const pactMembers = pgTable(
  'pact_members',
  {
    pactId: uuid()
      .notNull()
      .references(() => pacts.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: pactRole().notNull().default('member'),
    invitedBy: uuid(),
    joinedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.pactId, t.userId] }),
    index('pact_members_user_idx').on(t.userId),
  ],
);

export const pactHabits = pgTable(
  'pact_habits',
  {
    pactId: uuid()
      .notNull()
      .references(() => pacts.id, { onDelete: 'cascade' }),
    habitId: uuid()
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.pactId, t.habitId] }),
    index('pact_habits_habit_idx').on(t.habitId),
  ],
);

export const reactions = pgTable(
  'reactions',
  {
    logId: uuid()
      .notNull()
      .references(() => habitLogs.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.logId, t.userId, t.emoji] })],
);

export const nudges = pgTable(
  'nudges',
  {
    id: pk(),
    fromUser: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toUser: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    habitId: uuid()
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    localDate: date().notNull(),
    message: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('nudges_once_per_day_key').on(t.fromUser, t.habitId, t.localDate)],
);

export const xpEvents = pgTable(
  'xp_events',
  {
    id: pk(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    identity: text().notNull(),
    amount: integer().notNull(),
    reason: text().notNull(),
    refId: uuid(),
    createdAt: createdAt(),
  },
  (t) => [
    index('xp_events_user_idx').on(t.userId, t.identity),
    // El libro mayor no duplica premios por el mismo registro.
    uniqueIndex('xp_events_ref_key').on(t.userId, t.reason, t.refId),
  ],
);

export const achievements = pgTable('achievements', {
  code: text().primaryKey(),
  title: text().notNull(),
  description: text().notNull(),
  icon: text().notNull(),
});

export const userAchievements = pgTable(
  'user_achievements',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text()
      .notNull()
      .references(() => achievements.code),
    unlockedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.code] })],
);

export const notifications = pgTable(
  'notifications',
  {
    id: pk(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    payload: jsonb().$type<{ title: string; body: string; url?: string | null }>().notNull(),
    readAt: timestamp({ withTimezone: true }),
    pushedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_read_idx').on(t.userId, t.readAt)],
);

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: pk(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text().notNull(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    userAgent: text(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('push_subscriptions_endpoint_key').on(t.endpoint)],
);

export const jobs = pgTable(
  'jobs',
  {
    id: pk(),
    type: text().notNull(),
    /** Clave opcional para que un trabajo exista una sola vez (por ejemplo "reminder:<habitId>"). */
    uniqueKey: text(),
    runAt: timestamp({ withTimezone: true }).notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    lockedAt: timestamp({ withTimezone: true }),
    attempts: integer().notNull().default(0),
    lastError: text(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('jobs_unique_key').on(t.uniqueKey),
    index('jobs_run_at_idx').on(t.runAt).where(sql`${t.lockedAt} IS NULL`),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: pk(),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    action: text().notNull(),
    ip: text(),
    userAgent: text(),
    meta: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('audit_log_user_idx').on(t.userId)],
);
