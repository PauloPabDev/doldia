/* Service worker de Hábitos, escrito a mano y sin plugins. */
const VERSION = 'v2';
const SHELL = `shell-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const DATA = `data-${VERSION}`;
const PRECACHE = ['/offline', '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)));
  // No se activa solo: la app muestra "Hay una nueva versión" y decide cuándo.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, PAGES, DATA]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  // Al cerrar sesión no deben quedar datos del usuario en caché.
  if (event.data === 'CLEAR')
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(DATA)]));
});

const NETWORK_ONLY = /^\/api\/v1\/(auth|notifications|push|logs|nudges)/;
const NETWORK_FIRST_API =
  /^\/api\/v1\/(today|me\/progress|pacts\/[^/]+\/feed|pacts\/[^/]+$|habits)/;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (NETWORK_ONLY.test(url.pathname)) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, SHELL));
  } else if (url.pathname.startsWith('/api/')) {
    if (NETWORK_FIRST_API.test(url.pathname)) event.respondWith(networkFirst(request, DATA));
  } else if (request.mode === 'navigate' || request.headers.get('RSC') === '1') {
    event.respondWith(networkFirst(request, PAGES, true));
  }
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) (await caches.open(cacheName)).put(request, res.clone());
  return res;
}

// Las páginas van primero a la red: el HTML trae los registros del día y una copia
// en caché mostraría hábitos ya hechos como pendientes. Sin red se usa la copia.
async function networkFirst(request, cacheName, offlineFallback = false) {
  try {
    const res = await fetch(request);
    if (res.ok && !res.redirected) (await caches.open(cacheName)).put(request, res.clone());
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (offlineFallback && request.mode === 'navigate') return caches.match('/offline');
    return Response.json({ error: { code: 'offline', message: 'Sin conexión' } }, { status: 503 });
  }
}

/* ---------- Cola offline (misma base que lib/offline-queue.ts) ---------- */

function openQueue() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('habitos-offline', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('queue', { keyPath: 'clientId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueOp(mode, fn) {
  const db = await openQueue();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', mode);
    const req = fn(tx.objectStore('queue'));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

function apiFetch(path, body) {
  const send = () =>
    fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify(body),
    });
  return send().then(async (res) => {
    if (res.status !== 401) return res;
    const refreshed = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'fetch' },
    });
    return refreshed.ok ? send() : res;
  });
}

async function flushQueue() {
  const items = await queueOp('readonly', (s) => s.getAll());
  if (!items?.length) return;
  const logs = items.slice(0, 100).map(({ queuedAt: _queuedAt, ...log }) => log);
  const res = await apiFetch('/api/v1/logs/sync', { logs });
  if (!res.ok) throw new Error(`sync ${res.status}`);
  const { results } = await res.json();
  await queueOp('readwrite', (s) => {
    for (const r of results) s.delete(r.clientId);
  });
  for (const client of await self.clients.matchAll()) client.postMessage({ type: 'synced' });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'habitos-sync') event.waitUntil(flushQueue());
});

/* ---------- Push ---------- */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Hábitos', body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Hábitos', {
      body: data.body,
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/hoy', habitId: data.habitId },
      actions: data.actions || [],
    }),
  );
});

function deviceToday() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

self.addEventListener('notificationclick', (event) => {
  const { url, habitId } = event.notification.data || {};
  event.notification.close();

  // "Hecho" o "Versión de 2 min": registra sin abrir la app.
  if (habitId && (event.action === 'done' || event.action === 'min')) {
    const log = {
      clientId: crypto.randomUUID(),
      habitId,
      localDate: deviceToday(),
      status: event.action,
      value: null,
      note: null,
    };
    event.waitUntil(
      apiFetch(`/api/v1/habits/${habitId}/logs`, log)
        .then((res) => {
          if (!res.ok && res.status !== 409) throw new Error(String(res.status));
          return self.registration.showNotification('¡Registrado!', {
            body:
              event.action === 'min'
                ? 'La versión de 2 minutos también cuenta.'
                : 'Un voto más por quien quieres ser.',
            tag: 'checked-in',
            icon: '/icons/icon-192.png',
          });
        })
        .catch(async () => {
          await queueOp('readwrite', (s) => s.put({ ...log, queuedAt: Date.now() }));
          if (self.registration.sync)
            await self.registration.sync.register('habitos-sync').catch(() => {});
        }),
    );
    return;
  }

  event.waitUntil(
    (async () => {
      const target = new URL(url || '/hoy', self.location.origin).href;
      for (const client of await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })) {
        if ('focus' in client) {
          await client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
