/* FALLTEM — Completa la palabra — Service Worker */

const CACHE_NAME = 'completa-v1.0.1'; // ⬅ subí la versión cuando cambies assets

// Ajustá paths si el proyecto vive en una subcarpeta (por ej. GitHub Pages)
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data/es-palabras.json',
  './images/completa-icon-192.png',
  './images/completa-icon-512.png',
  './manifest.webmanifest',
];

/* ===== Install: precache núcleo y activar al toque ===== */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ===== Activate: limpiar caches viejos y tomar control ===== */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* ===== Fetch: Stale-While-Revalidate para GET same-origin ===== */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // solo same-origin

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // 1) Intentar responder rápido desde caché
    const cached = await cache.match(req);

    // 2) En paralelo, ir a la red y actualizar caché
    const networkPromise = fetch(req).then((res) => {
      // Guardar copia válida (type 'basic' = same-origin)
      if (res && res.status === 200 && res.type === 'basic') {
        cache.put(req, res.clone());
      }
      return res;
    }).catch(() => {
      // Si la red falla, al menos devolvés lo cacheado (si existe)
      return cached;
    });

    // Devolvés el caché si existe; si no, esperás a la red
    return cached || networkPromise;
  })());
});

/* ===== Mensajes: permitir activar SW nuevo sin esperar ===== */
self.addEventListener('message', (event) => {
  if (event && event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
