const CACHE_PREFIX = "vykonak-kalkulator-";
const CACHE_NAME = `${CACHE_PREFIX}v927`;
const ASSETS = [
  "./",
  "./index.html",
  "./index.html?v=927",
  "./styles.css?v=927",
  "./app.js?v=927",
  "./counter-worker.js?v=927",
  "./counter-engine.js?v=927",
  "./counter-sweep.js?v=927",
  "./manifest.webmanifest?v=927",
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
