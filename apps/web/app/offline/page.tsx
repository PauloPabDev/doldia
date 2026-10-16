import { EmptyState } from '@habitos/ui';

export const metadata = { title: 'Sin conexión' };

export default function OfflinePage() {
  return (
    <main className="page">
      <EmptyState
        icon="offline"
        title="Estás sin conexión"
        body="Tus registros se guardan en el teléfono y se envían solos cuando vuelva la red."
      />
    </main>
  );
}
