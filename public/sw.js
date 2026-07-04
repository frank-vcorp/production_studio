/**
 * Bridge SW — service worker mínimo solo para notification handling.
 * Spec: SPEC-S2-ROBUSTNESS §Tarea 2.6.
 *
 * NO intercepta fetch (esa lógica vive en vite/Cloudflare Worker).
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        // @ts-ignore — feature detection
        if ('focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('/');
    }),
  );
});

self.addEventListener('push', (event) => {
  // Stub: si más adelante se quiere push real, aquí se muestra la notificación.
  const data = event.data ? event.data.text() : 'Nueva notificación';
  event.waitUntil(
    self.registration.showNotification('Bridge', {
      body: data,
      tag: 'push',
    }),
  );
});