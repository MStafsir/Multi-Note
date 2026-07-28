// ============================================================
// MODUL 53: Service Worker — Vanilla implementation
// Replaces Serwist-based SW which failed evaluation.
// This vanilla SW uses only standard ServiceWorker APIs
// (no window/document dependencies, no complex bundling).
//
// Features:
//   - Cache-first-if-exists for /api/files/[nodeId]/content (Tier 1 blobs)
//     Range requests → skip cache, always network (video/audio seeking)
//     Only cache 200 (Full Content) responses — NOT 206 (Partial Content)
//   - /api/upload → network-only (mutations must hit server)
//   - Static assets → cache-first (precache on install)
// ============================================================

const CACHE_NAMES = {
  blobs: 'preview-blobs-v1',
  static: 'static-v1',
};

// Maximum entries and age for blob cache
const BLOB_MAX_ENTRIES = 200;
const BLOB_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// Install: claim clients immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate: clean up old caches, claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !Object.values(CACHE_NAMES).includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch handler: routing based on URL pattern
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Rule: /api/upload → network-only (mutations must hit server)
  if (url.pathname.startsWith('/api/upload')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Rule: /api/files/[nodeId]/content → cache-first-if-exists (Tier 1 blobs)
  if (url.pathname.match(/^\/api\/files\/[^/]+\/content$/)) {
    handleBlobFetch(event);
    return;
  }

  // Rule: static assets → cache-first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$/i)) {
    handleStaticFetch(event);
    return;
  }

  // Default: network-first for everything else
  // (API calls, HTML pages, etc.)
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});

// Cache-first-if-exists strategy for blob content
// Range requests bypass cache; non-Range requests check cache first
async function handleBlobFetch(event: FetchEvent) {
  // Range request → skip cache, always go to network (video/audio seeking)
  const rangeHeader = event.request.headers.get('Range');
  if (rangeHeader) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Check Cache API for matching URL
        const cachedResponse = await caches.match(event.request, {
          cacheName: CACHE_NAMES.blobs,
        });

        if (cachedResponse) {
          // Check if cached entry has expired (manual expiration check)
          const dateHeader = cachedResponse.headers.get('sw-cache-date');
          if (dateHeader) {
            const cacheDate = new Date(dateHeader).getTime();
            const age = Date.now() - cacheDate;
            if (age > BLOB_MAX_AGE_MS) {
              // Stale — remove from cache and re-fetch
              const cache = await caches.open(CACHE_NAMES.blobs);
              cache.delete(event.request);
              // Fall through to network fetch below
            } else {
              // Cache hit — return cached response
              return cachedResponse;
            }
          } else {
            // No date header but cached — return it
            return cachedResponse;
          }
        }

        // Cache miss or expired — fetch from network
        const networkResponse = await fetch(event.request);

        // Only cache 200 (Full Content) responses — NOT 206 (Partial Content)
        if (networkResponse.status === 200) {
          // Clone the response before caching (response can only be consumed once)
          const responseToCache = networkResponse.clone();

          // Create a new response with the cache-date header added
          const headers = new Headers(responseToCache.headers);
          headers.set('sw-cache-date', new Date().toISOString());

          const cacheableResponse = new Response(responseToCache.body, {
            status: responseToCache.status,
            statusText: responseToCache.statusText,
            headers,
          });

          // Store in cache asynchronously — don't block the response
          const cache = await caches.open(CACHE_NAMES.blobs);
          cache.put(event.request, cacheableResponse).catch((err) => {
            console.warn('[SW] Failed to cache blob response:', err);
          });

          // LRU eviction: if cache has too many entries, delete oldest
          evictBlobCache(cache);
        }

        return networkResponse;
      } catch (err) {
        // Network failed and no cache — return offline response
        console.warn('[SW] Blob fetch failed, no cache available:', err);

        return new Response('Offline — file not available', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    })()
  );
}

// LRU eviction for blob cache — removes oldest entries if over max
async function evictBlobCache(cache: Cache) {
  try {
    const keys = await cache.keys();
    if (keys.length > BLOB_MAX_ENTRIES) {
      // Delete oldest entries (first in the list)
      const toDelete = keys.slice(0, keys.length - BLOB_MAX_ENTRIES);
      for (const key of toDelete) {
        await cache.delete(key);
      }
    }
  } catch (err) {
    console.warn('[SW] Blob cache eviction failed:', err);
  }
}

// Cache-first strategy for static assets
async function handleStaticFetch(event: FetchEvent) {
  const cachedResponse = await caches.match(event.request, {
    cacheName: CACHE_NAMES.static,
  });

  if (cachedResponse) {
    return cachedResponse;
  }

  event.respondWith(
    fetch(event.request).then(async (networkResponse) => {
      if (networkResponse.status === 200) {
        const cache = await caches.open(CACHE_NAMES.static);
        cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    }).catch(async () => {
      // Network failed — try any cache
      const fallback = await caches.match(event.request);
      return fallback || new Response('Offline', { status: 503 });
    })
  );
}
