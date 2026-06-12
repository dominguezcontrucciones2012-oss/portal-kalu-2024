// ============================================================
// KALU NEVA - Service Worker PWA (v7 - 2026-06-11)
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
// Actualizaciones se aplican silenciosamente en segundo plano.
// ============================================================

const CACHE_STATIC = 'kalu-static-v7';
const CACHE_PAGES  = 'kalu-pages-v7';

// ── INSTALL: pre-cachear el shell básico ──────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_PAGES).then(cache =>
      cache.addAll(['/index.html', '/manifest.json', '/logo.png'])
    ).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: borrar cachés viejos ───────────────────────────
self.addEventListener('activate', (e) => {
  const validCaches = [CACHE_STATIC, CACHE_PAGES];
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !validCaches.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia por tipo de recurso ────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Solo manejar peticiones GET de nuestro dominio
  if (request.method !== 'GET') return;
  if (!url.origin.startsWith('https://kalu-queso-sanjuam') &&
      !url.hostname.includes('localhost')) return;

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
          });
        })
      )
    );
    return;
  }

  // ── Estrategia 2: index.html y rutas de navegación ──────
  // NETWORK-FIRST: siempre intenta obtener versión nueva
  if (request.mode === 'navigate' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(request)
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
