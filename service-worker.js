const CACHE_NAME = "ipl-prediction-league-v5";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app/loader.js",
  "./app/app.js",
  "./app/config.js",
  "./app/styles.css",
  "./manifest.webmanifest",
  "./app-icon.svg",
];

const NETWORK_FIRST_EXTENSIONS = [
  ".html",
  ".js",
  ".css",
  ".svg",
  ".webmanifest",
];

function isCacheableResponse(response) {
  return Boolean(response?.ok) && ["basic", "default"].includes(response.type);
}

function shouldUseNetworkFirst(request, requestUrl) {
  if (request.mode === "navigate") {
    return true;
  }

  if (["script", "style", "document"].includes(request.destination)) {
    return true;
  }

  return NETWORK_FIRST_EXTENSIONS.some((extension) =>
    requestUrl.pathname.endsWith(extension),
  );
}

async function storeInCache(request, response) {
  if (!isCacheableResponse(response)) {
    return response;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    return await storeInCache(request, networkResponse);
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  return await storeInCache(request, networkResponse);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    shouldUseNetworkFirst(event.request, requestUrl)
      ? networkFirst(event.request)
      : cacheFirst(event.request),
  );
});
