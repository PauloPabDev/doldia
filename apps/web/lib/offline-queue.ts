import type { LogStatus, SyncLogsResponse } from '@habitos/contracts';
import { API_BASE, refreshSession } from './api';

/**
 * Cola offline en IndexedDB. El service worker lee la misma base (habitos-offline,
 * almacén "queue") para sincronizar con Background Sync.
 */
export interface QueuedLog {
  clientId: string;
  habitId: string;
  localDate: string;
  status: LogStatus;
  value: number | null;
  note: string | null;
  queuedAt: number;
}

const DB_NAME = 'habitos-offline';
const STORE = 'queue';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'clientId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    t.onerror = () => reject(t.error);
  });
}

export async function enqueue(item: QueuedLog) {
  await tx('readwrite', (s) => s.put(item));
  // Background Sync donde exista; el evento "online" queda como respaldo.
  const reg = await navigator.serviceWorker?.ready.catch(() => undefined);
  const sync = (
    reg as
      | (ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })
      | undefined
  )?.sync;
  await sync?.register('habitos-sync').catch(() => undefined);
  window.dispatchEvent(new CustomEvent('habitos:queue'));
}

export function pending(): Promise<QueuedLog[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<QueuedLog[]>);
}

async function remove(ids: string[]) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    for (const id of ids) t.objectStore(STORE).delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  db.close();
}

let flushing: Promise<{ synced: number; failed: string[] }> | null = null;

/** Envía el lote a /logs/sync. Los errores permanentes se descartan y se reportan. */
export function flush() {
  flushing ??= (async () => {
    const items = await pending();
    if (!items.length || !navigator.onLine) return { synced: 0, failed: [] };
    const body = JSON.stringify({
      logs: items.slice(0, 100).map(({ queuedAt: _q, ...log }) => log),
    });
    const post = () =>
      fetch(`${API_BASE}/logs/sync`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body,
      });
    let res = await post().catch(() => null);
    if (res?.status === 401 && (await refreshSession())) res = await post().catch(() => null);
    if (!res?.ok) return { synced: 0, failed: [] };
    const { results } = (await res.json()) as SyncLogsResponse;
    await remove(results.map((r) => r.clientId));
    window.dispatchEvent(new CustomEvent('habitos:queue'));
    return {
      synced: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).map((r) => r.error ?? 'Error'),
    };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
