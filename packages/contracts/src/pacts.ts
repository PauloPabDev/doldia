import { z } from 'zod';
import { id, localDate } from './common';
import { habitKind, logStatus } from './habits';

/** Seis acentos accesibles (contraste ≥ 4.5:1 sobre el fondo claro con texto blanco). */
export const PACT_ACCENTS = [
  '#2F6F5E',
  '#5B7FA6',
  '#9A4F96',
  '#B5523B',
  '#8A6A12',
  '#3D6B8C',
] as const;
export const pactAccent = z.enum(PACT_ACCENTS);

export const PACT_MAX_MEMBERS = 8;

export const createPactInput = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre al pacto').max(60),
  goal: z.string().trim().max(140).nullable().default(null),
  endsAt: localDate.nullable().default(null),
  accent: pactAccent.default('#2F6F5E'),
  /** Meta cooperativa: registros que el grupo quiere sumar en el mes. */
  monthlyTarget: z.number().int().min(1).max(10_000).default(100),
  habitIds: z.array(id).max(10).default([]),
});
export type CreatePactInput = z.input<typeof createPactInput>;

export const updatePactInput = createPactInput.omit({ habitIds: true }).partial();

export const shareHabitsInput = z.object({ habitIds: z.array(id).max(10) });

export const memberSummary = z.object({
  userId: id,
  displayName: z.string(),
  role: z.enum(['owner', 'member']),
  loggedToday: z.boolean(),
  joinedAt: z.string(),
  habits: z.array(z.object({ id, title: z.string(), loggedToday: z.boolean() })),
});

export const pact = z.object({
  id,
  name: z.string(),
  goal: z.string().nullable(),
  accent: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  monthlyTarget: z.number().int(),
  inviteCode: z.string().nullable(),
  members: z.array(memberSummary),
  groupStreak: z.number().int(),
  monthlyCount: z.number().int(),
  /** Crecimiento del jardín (0 a 1) según los registros del grupo en la semana. */
  garden: z.number(),
  myHabitIds: z.array(id),
});
export type Pact = z.infer<typeof pact>;

export const invitePreview = z.object({
  pactId: id,
  name: z.string(),
  goal: z.string().nullable(),
  accent: z.string(),
  invitedBy: z.string(),
  memberCount: z.number().int(),
  members: z.array(z.string()),
  full: z.boolean(),
});
export type InvitePreview = z.infer<typeof invitePreview>;

export const REACTIONS = ['👏', '🔥', '💪', '🙌', '❤️', '🌱'] as const;
export const reactionEmoji = z.enum(REACTIONS);
export const reactionInput = z.object({ emoji: reactionEmoji });

export const feedItem = z.object({
  logId: id,
  user: z.object({ id, displayName: z.string() }),
  habit: z.object({ id, title: z.string(), identity: z.string(), kind: habitKind }),
  status: logStatus,
  localDate: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
  reactions: z.array(z.object({ emoji: z.string(), count: z.number().int(), mine: z.boolean() })),
});
export type FeedItem = z.infer<typeof feedItem>;

export const feedResponse = z.object({
  items: z.array(feedItem),
  nextCursor: z.string().nullable(),
});
export type FeedResponse = z.infer<typeof feedResponse>;

/** Empujones con frases amables ya escritas, para que nadie escriba algo hiriente. */
export const NUDGE_MESSAGES = {
  together: 'Hoy lo hacemos juntos 💪',
  two_min: '¿Y si haces la versión de 2 minutos?',
  thinking: 'Pensando en ti, tú puedes',
  proud: 'Me inspira verte constante',
} as const;
export const nudgeMessage = z.enum(Object.keys(NUDGE_MESSAGES) as [keyof typeof NUDGE_MESSAGES]);

export const nudgeInput = z.object({
  toUserId: id,
  habitId: id,
  message: nudgeMessage,
});
export type NudgeInput = z.input<typeof nudgeInput>;
