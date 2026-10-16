import { notificationsResponse } from '@habitos/contracts';
import type { Metadata } from 'next';
import { serverApi } from '@/lib/server-api';
import { Inbox } from './inbox';

export const metadata: Metadata = { title: 'Notificaciones' };

export default async function NotificationsPage() {
  const data = await serverApi('/notifications', {
    schema: notificationsResponse,
    next: '/notificaciones',
  });
  return <Inbox initial={data} />;
}
