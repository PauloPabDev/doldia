import { z } from 'zod';
import { id, localDate, timeOfDay } from './common';
import { identityKey } from './gamification';

export const habitKind = z.enum(['build', 'break']);
export type HabitKind = z.infer<typeof habitKind>;

/** Quién ve los registros: solo yo, mis pactos o todos mis amigos. */
export const visibility = z.enum(['private', 'pact', 'friends']);
export type Visibility = z.infer<typeof visibility>;

const habitFields = {
  kind: habitKind,
  identity: identityKey,
  title: z.string().trim().min(1, 'Ponle un nombre al hábito').max(80),
  minVersion: z.string().trim().max(120).nullable(),
  cueTime: timeOfDay.nullable(),
  cuePlace: z.string().trim().max(80).nullable(),
  stackedOn: id.nullable(),
  visibility,
  /** Solo hábitos a romper: qué lo dispara y con qué se reemplaza. */
  triggers: z.array(z.string().trim().min(1).max(60)).max(10),
  substitute: z.string().trim().max(120).nullable(),
  /** Las recaídas son privadas por defecto. */
  relapseVisibility: z.enum(['private', 'pact']),
  /** Contador de libertad: lo que se gana por día sin el hábito (por ejemplo 8000 COP o 2 h). */
  savingsPerDay: z.number().nonnegative().max(1_000_000).nullable(),
  savingsUnit: z.string().trim().max(12).nullable(),
};

export const createHabitInput = z.object({
  ...habitFields,
  minVersion: habitFields.minVersion.default(null),
  cueTime: habitFields.cueTime.default(null),
  cuePlace: habitFields.cuePlace.default(null),
  stackedOn: habitFields.stackedOn.default(null),
  visibility: visibility.default('pact'),
  triggers: habitFields.triggers.default([]),
  substitute: habitFields.substitute.default(null),
  relapseVisibility: habitFields.relapseVisibility.default('private'),
  savingsPerDay: habitFields.savingsPerDay.default(null),
  savingsUnit: habitFields.savingsUnit.default(null),
});
export type CreateHabitInput = z.input<typeof createHabitInput>;

export const updateHabitInput = z.object(habitFields).omit({ kind: true }).partial();
export type UpdateHabitInput = z.input<typeof updateHabitInput>;

export const streak = z.object({
  current: z.number().int(),
  best: z.number().int(),
  freezesLeft: z.number().int(),
  lastDate: z.string().nullable(),
});
export type Streak = z.infer<typeof streak>;

export const logStatus = z.enum(['done', 'min', 'relapse', 'skip']);
export type LogStatus = z.infer<typeof logStatus>;

export const habitLog = z.object({
  id,
  habitId: id,
  localDate: z.string(),
  status: logStatus,
  value: z.number().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type HabitLog = z.infer<typeof habitLog>;

export const habit = z.object({
  id,
  ...habitFields,
  createdAt: z.string(),
  archivedAt: z.string().nullable(),
  streak,
  /** Registro de hoy (fecha local del usuario), si existe. */
  today: habitLog.nullable(),
  /** Para hábitos a romper: días sin recaer y lo ganado. */
  freedom: z.object({ days: z.number().int(), saved: z.number().nullable() }).nullable(),
  pactIds: z.array(id),
});
export type Habit = z.infer<typeof habit>;

export const habitDetail = habit.extend({
  logs: z.array(habitLog),
  votes: z.number().int(),
});
export type HabitDetail = z.infer<typeof habitDetail>;

export const todayResponse = z.object({
  localDate: z.string(),
  habits: z.array(habit),
  votesToday: z.number().int(),
});
export type TodayResponse = z.infer<typeof todayResponse>;

export const createLogInput = z.object({
  localDate: localDate.optional(),
  status: logStatus,
  value: z.number().finite().nullable().default(null),
  note: z.string().trim().max(280).nullable().default(null),
  /** Generado en el cliente; evita duplicados cuando la cola offline reintenta. */
  clientId: id,
});
export type CreateLogInput = z.input<typeof createLogInput>;

export const syncLogsInput = z.object({
  logs: z
    .array(createLogInput.extend({ habitId: id, localDate }))
    .min(1)
    .max(100),
});
export type SyncLogsInput = z.input<typeof syncLogsInput>;

export const gainedReward = z.object({
  xp: z.number().int(),
  levelUp: z
    .object({ identity: identityKey, level: z.number().int(), title: z.string() })
    .nullable(),
  achievements: z.array(z.object({ code: z.string(), title: z.string() })),
});
export type GainedReward = z.infer<typeof gainedReward>;

export const logResponse = z.object({
  log: habitLog,
  streak,
  reward: gainedReward,
  duplicate: z.boolean(),
});
export type LogResponse = z.infer<typeof logResponse>;

export const syncLogsResponse = z.object({
  results: z.array(
    z.object({
      clientId: id,
      ok: z.boolean(),
      error: z.string().optional(),
      response: logResponse.optional(),
    }),
  ),
});
export type SyncLogsResponse = z.infer<typeof syncLogsResponse>;
