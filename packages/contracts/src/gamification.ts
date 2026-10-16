import { z } from 'zod';

/**
 * Catálogo de identidades. Cada una tiene color e ícono propios para
 * reconocerla de un vistazo; los títulos por nivel refuerzan "quién estás siendo".
 */
export const IDENTITIES = {
  reader: { label: 'Lector', noun: 'ser lector', icon: 'book', color: '#5B7FA6' },
  athlete: { label: 'Atleta', noun: 'ser atleta', icon: 'run', color: '#E8735A' },
  healthy: { label: 'Saludable', noun: 'cuidar tu salud', icon: 'leaf', color: '#2F6F5E' },
  focused: { label: 'Enfocado', noun: 'estar enfocado', icon: 'target', color: '#7A5BA6' },
  calm: { label: 'En calma', noun: 'vivir en calma', icon: 'wave', color: '#4D9AA6' },
  creative: { label: 'Creativo', noun: 'ser creativo', icon: 'spark', color: '#E0A526' },
  free: { label: 'Libre', noun: 'ser libre', icon: 'feather', color: '#5B7FA6' },
} as const;

export type IdentityKey = keyof typeof IDENTITIES;
export const identityKey = z.enum(Object.keys(IDENTITIES) as [IdentityKey, ...IdentityKey[]]);

export const LEVEL_TITLES = [
  'Principiante',
  'En camino',
  'Constante',
  'Comprometido',
  'Ejemplo',
  'Maestro',
];

/** XP necesario para alcanzar cada nivel (índice = nivel - 1). Crece suave para premiar la constancia. */
export const LEVEL_THRESHOLDS = [0, 50, 150, 350, 700, 1200, 2000, 3000, 4500, 6500];

export const XP = { done: 10, min: 5, relapseRecovered: 5, firstLog: 20 } as const;

export function levelFromXp(xp: number) {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= (LEVEL_THRESHOLDS[i] ?? Infinity)) level = i + 1;
  }
  const current = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = LEVEL_THRESHOLDS[level] ?? null;
  const progress = next === null ? 1 : (xp - current) / (next - current);
  return { level, current, next, progress };
}

export function levelTitle(identity: IdentityKey, level: number) {
  const base = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] ?? '';
  return `${IDENTITIES[identity].label} · ${base}`;
}

/** Logros definidos como datos: la API evalúa la regla y el front muestra la medalla. */
export const ACHIEVEMENTS = {
  first_vote: { title: 'Primer voto', description: 'Registraste tu primer hábito', icon: 'seed' },
  week_one: {
    title: 'Primera semana',
    description: '7 días de racha en un hábito',
    icon: 'sprout',
  },
  three_weeks: { title: '21 días', description: '21 días de racha en un hábito', icon: 'tree' },
  month: { title: 'Un mes', description: '30 días de racha en un hábito', icon: 'mountain' },
  comeback: {
    title: 'Volviste',
    description: 'Registraste al día siguiente de fallar',
    icon: 'sunrise',
  },
  relapse_overcome: {
    title: 'Recaída superada',
    description: '7 días libres después de una recaída',
    icon: 'feather',
  },
  first_pact: { title: 'En equipo', description: 'Te uniste a tu primer pacto', icon: 'hands' },
  cheerleader: {
    title: 'Porrista',
    description: 'Reaccionaste 10 veces a tus amigos',
    icon: 'heart',
  },
  level_up: {
    title: 'Nuevo nivel',
    description: 'Subiste de nivel en una identidad',
    icon: 'star',
  },
} as const;
export type AchievementCode = keyof typeof ACHIEVEMENTS;

export const identityProgress = z.object({
  identity: identityKey,
  xp: z.number().int(),
  votes: z.number().int(),
  level: z.number().int(),
  title: z.string(),
  nextLevelXp: z.number().int().nullable(),
  progress: z.number(),
});

export const progressResponse = z.object({
  totalXp: z.number().int(),
  identities: z.array(identityProgress),
  achievements: z.array(
    z.object({ code: z.string(), title: z.string(), icon: z.string(), unlockedAt: z.string() }),
  ),
  heatmap: z.array(z.object({ date: z.string(), count: z.number().int() })),
  missions: z.array(
    z.object({
      code: z.string(),
      title: z.string(),
      progress: z.number().int(),
      goal: z.number().int(),
    }),
  ),
});
export type ProgressResponse = z.infer<typeof progressResponse>;
