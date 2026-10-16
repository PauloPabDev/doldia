import { z } from 'zod';

export const id = z.uuid();

/** Fecha local del usuario (AAAA-MM-DD), nunca la del servidor. */
export const localDate = z.iso.date();

/** Hora del día en formato 24 h (HH:MM). */
export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:MM');

export const timezone = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Zona horaria no válida' },
);

export const errorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponse>;

export const okResponse = z.object({ ok: z.literal(true) });
