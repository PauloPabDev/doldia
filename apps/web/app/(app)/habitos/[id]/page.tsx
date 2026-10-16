import { habitDetail, me as meSchema } from '@habitos/contracts';
import type { Metadata } from 'next';
import { serverApi } from '@/lib/server-api';
import { HabitDetailView } from './habit-detail';

export const metadata: Metadata = { title: 'Hábito' };

export default async function HabitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [habit, me] = await Promise.all([
    serverApi(`/habits/${id}`, { schema: habitDetail, next: `/habitos/${id}` }),
    serverApi('/me', { schema: meSchema, next: `/habitos/${id}` }),
  ]);
  return <HabitDetailView habit={habit} timezone={me.timezone} />;
}
