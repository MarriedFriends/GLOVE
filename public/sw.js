// Minimal service worker: its presence makes Glove installable and it is the
// future home of push notifications. Intentionally NO fetch handler — we
// don't cache anything, so deploys are always picked up immediately and
// nothing can go stale.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
