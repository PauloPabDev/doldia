import { randomUUID } from 'node:crypto';
import { XP } from '@habitos/contracts';
import { eq, inArray } from 'drizzle-orm';
import { addDays, localToday } from '../common/time';
import { hashPassword } from '../modules/auth/password';
import { buildStreak, freedomStreak } from '../modules/habits/streak';
import { createDb } from './client';
import {
  habitLogs,
  habits,
  pactHabits,
  pactMembers,
  pacts,
  reactions,
  streaks,
  users,
  xpEvents,
} from './schema';

const TZ = 'America/Bogota';
const PASSWORD = 'habitos123';
const PEOPLE = [
  { email: 'ana@habitos.dev', displayName: 'Ana' },
  { email: 'beto@habitos.dev', displayName: 'Beto' },
  { email: 'carla@habitos.dev', displayName: 'Carla' },
];

/** Probabilidad de cumplir cada día, para que las rachas se vean realistas. */
const CONSISTENCY = [0.9, 0.75, 0.6];

/** Generador con semilla fija (mulberry32): cada `db:seed` deja los mismos datos. */
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = seededRandom(2026);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no está definida');
  const { db, pool } = createDb(url);
  const today = localToday(TZ);
  const start = addDays(today, -14);

  await db.delete(users).where(
    inArray(
      users.email,
      PEOPLE.map((p) => p.email),
    ),
  );
  await db.delete(pacts).where(eq(pacts.inviteCode, 'AMIGOS26'));

  const passwordHash = await hashPassword(PASSWORD);
  const created = await db
    .insert(users)
    .values(
      PEOPLE.map((p) => ({
        ...p,
        passwordHash,
        timezone: TZ,
        onboarded: true,
        lastClosedDate: addDays(today, -1),
      })),
    )
    .returning();

  const [pact] = await db
    .insert(pacts)
    .values({
      name: 'Madrugadores',
      goal: 'Moverse y leer un poco cada día',
      accent: '#2F6F5E',
      monthlyTarget: 120,
      startsAt: start,
      inviteCode: 'AMIGOS26',
      createdBy: created[0]!.id,
    })
    .returning();
  if (!pact) throw new Error('No se creó el pacto');

  const plans = [
    {
      title: 'Leer 10 páginas',
      identity: 'reader',
      minVersion: 'Leer 1 página',
      cueTime: '21:00',
      cuePlace: 'la cama',
    },
    {
      title: 'Correr 20 minutos',
      identity: 'athlete',
      minVersion: 'Ponerme los tenis',
      cueTime: '06:30',
      cuePlace: 'el parque',
    },
    {
      title: 'Meditar',
      identity: 'calm',
      minVersion: 'Tres respiraciones',
      cueTime: '07:00',
      cuePlace: 'la sala',
    },
  ];

  const allLogs: Array<typeof habitLogs.$inferInsert> = [];
  for (const [i, user] of created.entries()) {
    await db.insert(pactMembers).values({
      pactId: pact.id,
      userId: user.id,
      role: i === 0 ? 'owner' : 'member',
      joinedAt: new Date(Date.now() - 14 * 86_400_000),
    });
    const plan = plans[i]!;
    const [habit] = await db
      .insert(habits)
      .values({ userId: user.id, kind: 'build', ...plan, startDate: start })
      .returning();
    const [quit] = await db
      .insert(habits)
      .values({
        userId: user.id,
        kind: 'break',
        identity: 'free',
        title: 'Redes sociales de noche',
        triggers: ['aburrimiento', 'cansancio'],
        substitute: 'Leer o estirar',
        savingsPerDay: 1.5,
        savingsUnit: 'h',
        visibility: 'private',
        startDate: start,
      })
      .returning();
    if (!habit || !quit) throw new Error('No se crearon hábitos');
    await db.insert(pactHabits).values({ pactId: pact.id, habitId: habit.id });

    const logs: Array<typeof habitLogs.$inferInsert> = [];
    for (let d = 14; d >= 1; d--) {
      const day = addDays(today, -d);
      const roll = random();
      if (roll < CONSISTENCY[i]!) {
        logs.push({
          habitId: habit.id,
          userId: user.id,
          localDate: day,
          status: roll < CONSISTENCY[i]! * 0.8 ? 'done' : 'min',
          clientId: randomUUID(),
          createdAt: new Date(`${day}T12:00:00Z`),
        });
      }
    }
    if (i === 1) {
      logs.push({
        habitId: quit.id,
        userId: user.id,
        localDate: addDays(today, -6),
        status: 'relapse',
        clientId: randomUUID(),
      });
    }
    if (logs.length) {
      const inserted = await db.insert(habitLogs).values(logs).returning();
      allLogs.push(...inserted);
      const votes = inserted.filter((l) => l.status === 'done' || l.status === 'min');
      if (votes.length) {
        await db.insert(xpEvents).values(
          votes.map((l) => ({
            userId: user.id,
            identity: plan.identity,
            amount: l.status === 'done' ? XP.done : XP.min,
            reason: 'log',
            refId: l.id,
          })),
        );
      }
    }
    const b = buildStreak(
      logs
        .filter((l) => l.habitId === habit.id)
        .map((l) => ({ localDate: l.localDate, status: l.status })),
      today,
    );
    const f = freedomStreak(
      logs
        .filter((l) => l.habitId === quit.id)
        .map((l) => ({ localDate: l.localDate, status: l.status })),
      today,
      start,
    );
    await db.insert(streaks).values([
      { habitId: habit.id, current: b.current, best: b.best, lastDate: b.lastDate },
      { habitId: quit.id, current: f.current, best: f.best, lastDate: f.lastDate },
    ]);
  }

  // Reacciones cruzadas en los registros más recientes del pacto.
  const emojis = ['👏', '🔥', '💪', '🙌'];
  const recent = allLogs.filter((l) => l.status !== 'relapse' && l.localDate >= addDays(today, -4));
  const reactionRows = recent.flatMap((log, n) =>
    created
      .filter((u) => u.id !== log.userId)
      .slice(0, 1 + (n % 2))
      .map((u, k) => ({
        logId: log.id as string,
        userId: u.id,
        emoji: emojis[(n + k) % emojis.length]!,
      })),
  );
  if (reactionRows.length) await db.insert(reactions).values(reactionRows);

  await pool.end();
  console.log('Datos de prueba listos:');
  for (const p of PEOPLE) console.log(`  ${p.email} / ${PASSWORD}`);
  console.log('  Pacto "Madrugadores", código de invitación AMIGOS26');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
