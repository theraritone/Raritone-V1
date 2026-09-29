/**
 * Raritone's service worker.
 *
 * Two rules shape this file:
 *
 *  1. Nothing private is ever cached. `/api` holds the guest's session, wardrobe
 *     and remaining allowance, and `/media` holds their photos. A cached
 *     `/api/bootstrap` would show a guest garments they deleted and an allowance
 *     they already spent, so those paths are passed straight through to the
 *     network — offline, the app shows its own offline state instead of a lie.
 *
 *  2. Only successful, same-origin GETs are stored. Caching a 402 or a 404 would
 *     pin an error in place long after the condition that caused it.
 */

const VERSION = "v2";
const SHELL_CACHE = `raritone-shell-${VERSION}`;
const ASSET_CACHE = `raritone-assets-${VERSION}`;

const PRECACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // `addAll` rejects the whole install if any single entry 404s, which would
      // leave the app with no offline support at all. Adding individually and
      // tolerating misses is more robust than all-or-nothing.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Private, server-authoritative. Never read from or write to a cache.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/")) return;

  // Navigations: network first, so a deployed update is picked up immediately,
  // with the cached shell as the offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(async () => (await caches.match("/index.html")) ?? Response.error()),
    );
    return;
  }

  // Hashed build assets are immutable, so cache first and only go to the network
  // on a miss. Everything else stays network-only.
  const isImmutable = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/");
  if (!isImmutable) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
