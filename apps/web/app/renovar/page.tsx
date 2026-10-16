'use client';

import { Skeleton } from '@habitos/ui';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { refreshSession } from '@/lib/api';
import { safeNext } from '@/lib/safe-next';

/** El refresh solo viaja a /api/v1/auth: esta pantalla lo renueva y vuelve a donde ibas. */
function Renew() {
  const params = useSearchParams();
  useEffect(() => {
    const next = safeNext(params.get('next'));
    refreshSession().then((ok) => {
      window.location.replace(ok ? next : `/entrar?next=${encodeURIComponent(next)}`);
    });
  }, [params]);
  return (
    <main className="page">
      <Skeleton lines={4} />
    </main>
  );
}

export default function RenewPage() {
  return (
    <Suspense>
      <Renew />
    </Suspense>
  );
}
