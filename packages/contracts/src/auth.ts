import { z } from 'zod';
import { id, timeOfDay, timezone } from './common';

const email = z
  .email('Correo no válido')
  .max(254)
  .transform((v) => v.trim().toLowerCase());

const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga');

export const registerInput = z.object({
  email,
  password,
  displayName: z.string().trim().min(1, 'Escribe tu nombre').max(40),
  timezone: timezone.default('America/Bogota'),
});
export type RegisterInput = z.input<typeof registerInput>;

export const loginInput = z.object({
  email,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.input<typeof loginInput>;

export const changePasswordInput = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
});

export const notificationType = z.enum([
  'reminder',
  'reaction',
  'nudge',
  'pact_member',
  'streak_risk',
  'achievement',
  'weekly_summary',
]);
export type NotificationType = z.infer<typeof notificationType>;

export const notificationPrefs = z.record(notificationType, z.boolean());
export type NotificationPrefs = z.infer<typeof notificationPrefs>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  reminder: true,
  reaction: true,
  nudge: true,
  pact_member: true,
  streak_risk: true,
  achievement: true,
  weekly_summary: true,
};

export const me = z.object({
  id,
  email: z.string(),
  displayName: z.string(),
  timezone: z.string(),
  quietStart: timeOfDay,
  quietEnd: timeOfDay,
  notificationPrefs: notificationPrefs,
  onboarded: z.boolean(),
  calmMode: z.boolean(),
  createdAt: z.string(),
});
export type Me = z.infer<typeof me>;

export const updateMeInput = z
  .object({
    displayName: z.string().trim().min(1).max(40),
    timezone,
    quietStart: timeOfDay,
    quietEnd: timeOfDay,
    notificationPrefs: z.partialRecord(notificationType, z.boolean()),
    onboarded: z.boolean(),
    calmMode: z.boolean(),
  })
  .partial();
export type UpdateMeInput = z.input<typeof updateMeInput>;

export const authResponse = z.object({ user: me });
export type AuthResponse = z.infer<typeof authResponse>;
