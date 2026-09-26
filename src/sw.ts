// Cache version: v2026-04-25-oauth-fix
/// <reference lib="webworker" />
// @ts-ignore - resolved by vite-plugin-pwa at build time
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
// @ts-ignore - resolved by vite-plugin-pwa at build time
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
// @ts-ignore - resolved by vite-plugin-pwa at build time
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
// @ts-ignore - resolved by vite-plugin-pwa at build time
import { ExpirationPlugin } from 'workbox-expiration';
// @ts-ignore - resolved by vite-plugin-pwa at build time
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };

// Force new service worker to activate immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Clean old caches and precache static assets
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// OAuth routes (/~oauth/*): MUST never be intercepted by the SW.
// Do NOT register any route for them — let the browser hit the network directly.
// The NavigationRoute below also excludes them via denylist.

// Navigation requests: network-first with fallback (fixes blank page after cache clear)
const navigationStrategy = new NetworkFirst({
  cacheName: 'navigations',
  networkTimeoutSeconds: 5,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
  ],
});
registerRoute(new NavigationRoute(navigationStrategy, {
  denylist: [/^\/~oauth/],
}));

// Global catch handler: if any cached response fails, try network as last resort
setCatchHandler(async ({ request }) => {
  try {
    return await fetch(request);
  } catch {
    return Response.error();
  }
});

// Cache Supabase API calls (network-first) — but NEVER intercept auth endpoints
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co') && !url.pathname.startsWith('/auth/v1'),
  new NetworkFirst({
    cacheName: 'supabase-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Cache images (cache-first)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// ─── Push Notification Handler ───────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Drinkeros';
  const options: NotificationOptions = {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: data.url || '/app' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification Click Handler ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/app';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            const wc = client as WindowClient;
            // Abre a rota da notificação (ex.: /app/receitas) na janela existente
            return (wc.navigate ? wc.navigate(url).catch(() => wc) : Promise.resolve(wc))
              .then((c) => (c || wc).focus());
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
