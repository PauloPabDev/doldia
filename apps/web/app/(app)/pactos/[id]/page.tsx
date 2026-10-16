import { feedResponse, habit, me as meSchema, pact, z } from '@habitos/contracts';
import type { Metadata } from 'next';
import { serverApi } from '@/lib/server-api';
import { PactView } from './pact-view';

export const metadata: Metadata = { title: 'Pacto' };

export default async function PactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string; bienvenida?: string }>;
}) {
  const { id } = await params;
  const next = `/pactos/${id}`;
  const [p, feed, me, habits, sp] = await Promise.all([
    serverApi(`/pacts/${id}`, { schema: pact, next }),
    serverApi(`/pacts/${id}/feed`, { schema: feedResponse, next }),
    serverApi('/me', { schema: meSchema, next }),
    serverApi('/habits', { schema: z.array(habit), next }),
    searchParams,
  ]);
  return (
    <PactView
      pact={p}
      feed={feed}
      meId={me.id}
      habits={habits}
      justCreated={sp.nuevo === '1'}
      welcome={sp.bienvenida === '1'}
    />
  );
}
