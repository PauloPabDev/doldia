import { me as meSchema, pact as pactSchema, todayResponse, z } from '@habitos/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { serverApi } from '@/lib/server-api';
import { TodayView } from './today-view';

export const metadata: Metadata = { title: 'Hoy' };

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ registrar?: string }>;
}) {
  const [me, today, pacts, params] = await Promise.all([
    serverApi('/me', { schema: meSchema, next: '/hoy' }),
    serverApi('/today', { schema: todayResponse, next: '/hoy' }),
    serverApi('/pacts', { schema: z.array(pactSchema), next: '/hoy' }),
    searchParams,
  ]);
  if (!me.onboarded && today.habits.length === 0) redirect('/onboarding');
  return <TodayView initial={today} pacts={pacts} openHabitId={params.registrar} />;
}
