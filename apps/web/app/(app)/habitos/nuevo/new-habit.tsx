'use client';

import type { Habit } from '@habitos/contracts';
import { useToast } from '@habitos/ui';
import { useRouter } from 'next/navigation';
import { HabitWizard } from '@/components/habit-wizard';

export function NewHabit({ existing }: { existing: Habit[] }) {
  const router = useRouter();
  const { show } = useToast();
  return (
    <HabitWizard
      existing={existing}
      onCreated={(h) => {
        show({ message: `“${h.title}” listo. Todo se puede editar después.`, tone: 'celebrate' });
        router.push('/hoy');
        router.refresh();
      }}
    />
  );
}
