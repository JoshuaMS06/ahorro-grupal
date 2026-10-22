/* Caché del armazón PWA; nunca almacena datos de Firebase ni contraseñas. */
const VERSION = 'ahorro-shell-v3-violeta-20261022';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then(async (cache) => {
    await cache.addAll(SHELL);
    // La compilación Vite usa nombres con hash. Descubrir y guardar JS/CSS
    // referenciados en el HTML para que la interfaz abra tras instalarla.
    const htmlResponse = await cache.match('/');
    if (htmlResponse) {
      const html = await htmlResponse.text();
      const assetPaths = [...html.matchAll(/(?:src|href)=[\"'](\/assets\/[^\"']+)[\"']/g)].map((match) => match[1]);
      if (assetPaths.length) await cache.addAll(assetPaths);
    }
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Evitar cachear llamadas externas a Firebase/Auth y cualquier solicitud no local.
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) { const clone = response.clone(); caches.open(VERSION).then((cache) => cache.put('/', clone)).catch(() => {}); }
      return response;
    }).catch(async () => (await caches.match('/')) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
      const copy = response.clone();
      caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return response;
  })));
});
