// ============================================================
// KALU NEVA - Service Worker PWA (v8 - 2026-07-06)
// Estrategia optimizada para Portal del Cliente
// ============================================================
//
// REGLAS:
// 1. /assets/** → Cache-FIRST (tienen hash en el nombre, son inmutables)
//    Carga instantánea. Si cambió el archivo, cambió el nombre = nuevo download.
//
// 2. /index.html → Network-FIRST con fallback a caché
//    Siempre intenta obtener la versión más nueva.
//
// 3. /logo.png, /manifest.json → Stale-While-Revalidate
//    Usa lo que tiene guardado AHORA y actualiza en segundo plano.
//
// RESULTADO: App carga al instante desde la 2da vez en adelante.
// Actualizaciones limpian el caché viejo y recargan la app automáticamente.
// ============================================================

const CACHE_VERSION = 'v12';
const CACHE_STATIC = `kalu-static-${CACHE_VERSION}`;
const CACHE_PAGES  = `kalu-pages-${CACHE_VERSION}`;

// ── INSTALL: pre-cachear el shell básico ──────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_PAGES).then(cache =>
      cache.addAll(['/index.html', '/manifest.json', '/logo.png'])
    ).then(() => self.skipWaiting()) // ← Activar inmediatamente sin esperar
  );
});

// ── ACTIVATE: borrar TODOS los cachés viejos y tomar control ─
self.addEventListener('activate', (e) => {
  const validCaches = [CACHE_STATIC, CACHE_PAGES];
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !validCaches.includes(k)).map(k => {
          console.log('[SW] Eliminando caché viejo:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim()) // ← Tomar control de todas las pestañas abiertas
      .then(() => {
        // Notificar a todas las pestañas que hubo una actualización
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

// ── MENSAJE: permite forzar actualización desde la app ───────
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── FETCH: estrategia por tipo de recurso ────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Solo manejar peticiones GET de nuestro dominio
  if (request.method !== 'GET') return;
  if (!url.origin.startsWith('https://kalu-queso-sanjuam') &&
      !url.hostname.includes('localhost')) return;

  // No interceptar peticiones a Firebase (Auth, Firestore, Storage) ni a nuestra API
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('identitytoolkit')) return;

  // No interceptar llamadas a la API interna (Cloud Functions via rewrite)
  if (url.pathname.startsWith('/api/')) return;

  // ── Estrategia 1: Archivos /assets/ (JS, CSS con hash) ──
  // CACHE-FIRST: son inmutables, carga instantánea siempre
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.open(CACHE_STATIC).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached; // ✅ Instantáneo desde caché
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached); // Si falla la red, usar lo que hay
        })
      )
    );
    return;
  }

  // ── Estrategia 2: index.html y rutas de navegación ──────
  // NETWORK-FIRST: siempre intenta obtener versión nueva
  if (request.mode === 'navigate' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(request, { cache: 'no-cache' }) // Forzar petición fresca
        .then(response => {
          if (response.ok) {
            caches.open(CACHE_PAGES).then(c => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match('/index.html')) // Sin red: usar la guardada
    );
    return;
  }

  // ── Estrategia 3: Logo, manifest, íconos ─────────────────
  // STALE-WHILE-REVALIDATE: usa caché ahora, actualiza en segundo plano
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|json|mp4)$/)) {
    e.respondWith(
      caches.open(CACHE_PAGES).then(cache =>
        cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
          return cached || fetchPromise; // Si hay caché: úsala YA, actualiza después
        })
      )
    );
    return;
  }
});

// ── NOTIFICACIONES: manejar el clic en la notificación ──────
self.addEventListener('notificationclick', (e) => {
  e.notification.close(); // Cerrar la notificación

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Buscar si ya hay una pestaña abierta de Kalu
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('kalu-queso-sanjuam') || client.url.includes('localhost')) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      // Si no hay ninguna pestaña abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
