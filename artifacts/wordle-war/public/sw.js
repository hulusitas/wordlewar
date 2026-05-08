const CACHE = "wordle-war-v1";

// App shell assets to cache on install
const PRECACHE = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never intercept socket.io or api calls — always go network
  if (url.pathname.startsWith("/socket.io") || url.pathname.startsWith("/api")) {
    return;
  }

  // For navigation requests: network-first, fallback to cached index
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/"))
    );
    return;
  }

  // For sound / icon / static assets: cache-first
  if (
    url.pathname.startsWith("/sounds/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(js|css|woff2?|png|svg|ico)$/)
  ) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Default: network only
});
