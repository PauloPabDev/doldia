import { habit, pact, z } from '@habitos/contracts';
import type { Metadata } from 'next';
import { serverApi } from '@/lib/server-api';
import { PactsView } from './pacts-view';

export const metadata: Metadata = { title: 'Pactos' };

export default async function PactsPage({
  searchParams,
}: {
  searchParams: Promise<{ crear?: string }>;
}) {
  const [pacts, habits, params] = await Promise.all([
    serverApi('/pacts', { schema: z.array(pact), next: '/pactos' }),
    serverApi('/habits', { schema: z.array(habit), next: '/pactos' }),
    searchParams,
  ]);
  return <PactsView pacts={pacts} habits={habits} startCreating={params.crear === '1'} />;
}
