import { habit, z } from '@habitos/contracts';
import type { Metadata } from 'next';
import { serverApi } from '@/lib/server-api';
import { NewHabit } from './new-habit';

export const metadata: Metadata = { title: 'Nuevo hábito' };

export default async function NewHabitPage() {
  const existing = await serverApi('/habits', { schema: z.array(habit), next: '/habitos/nuevo' });
  return <NewHabit existing={existing} />;
}
