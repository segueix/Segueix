// Service Worker per PWA
// IMPORTANT: CANVIA AQUEST NÚMERO CADA VEGADA QUE PUBLIQUIS !!!
const CACHE_NAME = "mytube-v6";

const urlsToCache = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/config.js",
  "./js/data.js",
  "./js/youtube.js",
  "./manifest.json",
  "./data/feed.json"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : null)))
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const fresh = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  if (!event.request.url.startsWith("http")) return;

  const url = new URL(event.request.url);

  const isGoogleSheetsCSV =
    url.href.includes("docs.google.com/spreadsheets") && url.search.includes("output=csv");

  const isFeedJson = url.pathname.endsWith("/data/feed.json");

  const isAppShell =
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith("/manifest.json");

  // CSV sempre xarxa
  if (isGoogleSheetsCSV) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  // feed.json: network-first perquè el mòbil vegi les actualitzacions
  if (isFeedJson) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // App shell: network-first per versions noves
  if (isAppShell) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Resta: cache-first
  event.respondWith(cacheFirst(event.request));
});
