const CACHE_PREFIX = "vykonak-kalkulator-";
const CACHE_NAME = `${CACHE_PREFIX}v926`;
const ASSETS = [
  "./",
  "./index.html",
  "./index.html?v=926",
  "./styles.css?v=926",
  "./app.js?v=926",
  "./counter-worker.js?v=926",
  "./counter-engine.js?v=926",
  "./counter-sweep.js?v=926",
  "./manifest.webmanifest?v=926",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./solea-heart.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
