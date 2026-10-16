'use client';

import { Button, useToast } from '@habitos/ui';
import { useEffect, useState } from 'react';
import { flush, pending } from '@/lib/offline-queue';

/**
 * Registra el service worker, avisa cuando hay una versión nueva (sin perder
 * la cola offline) y sincroniza la cola al volver la red.
 */
export function ServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const { show } = useToast();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let reg: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((r) => {
      reg = r;
      if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
      r.addEventListener('updatefound', () => {
        const sw = r.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) setWaiting(sw);
        });
      });
    });

    let reloading = false;
    const onController = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onController);

    const sync = async () => {
      if (!(await pending()).length) return;
      const { synced, failed } = await flush();
      if (synced)
        show({
          message: `Sincronizamos ${synced} ${synced === 1 ? 'registro' : 'registros'}`,
          tone: 'celebrate',
        });
      if (failed.length) show({ message: `No se pudo sincronizar: ${failed[0]}`, tone: 'danger' });
    };
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'synced') window.dispatchEvent(new CustomEvent('habitos:queue'));
    };
    window.addEventListener('online', sync);
    navigator.serviceWorker.addEventListener('message', onMessage);
    void sync();
    const check = setInterval(() => reg?.update(), 60 * 60_000);

    return () => {
      window.removeEventListener('online', sync);
      navigator.serviceWorker.removeEventListener('controllerchange', onController);
      navigator.serviceWorker.removeEventListener('message', onMessage);
      clearInterval(check);
    };
  }, [show]);

  if (!waiting) return null;
  return (
    <div className="update-banner" role="status">
      <span>Hay una nueva versión</span>
      <Button size="md" variant="secondary" onClick={() => waiting.postMessage('SKIP_WAITING')}>
        Recargar
      </Button>
    </div>
  );
}
