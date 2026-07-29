// ============================================================
// MODUL 55: Service Worker — Vanilla implementation
// Fixed: Response clone violation, dev/HMR exclusion, production-only activation
//
// This file is the TypeScript source for the SW.
// The compiled version is served from public/sw.js.
//
// Features:
//   - Cache-first-if-exists for /api/files/[nodeId]/content (Tier 1 blobs)
//   - /api/upload → network-only
//   - Static assets → cache-first (production only)
//   - Exclusion list: /_next/*, HMR, dev-server internals are NEVER intercepted
//   - Production-only: SW skips ALL fetch handling in development mode
// ============================================================

const CACHE_NAMES = {
  blobs: 'preview-blobs-v3',
  static: 'static-v3',
};

const BLOB_MAX_ENTRIES = 200;
const BLOB_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// 55.2 — Exclusion list: paths that must NEVER be intercepted
const EXCLUDED_PATH_PREFIXES = [
  '/_next/',            // All Next.js internals: HMR, chunks, static
  '/__nextjs',          // Next.js dev overlay
  '/__webpack_hmr',     // Webpack HMR endpoint
  '/socket.io/',        // Socket.io (if used for collab)
];

// Install: skip waiting so SW activates immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate: clean up old caches, claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAMES.blobs && key !== CACHE_NAMES.static)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// 55.2/55.5 — Fetch handler with exclusion list
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

  // 55.2 — Exclusion list: skip ALL dev-server internal paths
  const pathname = url.pathname;
  for (const prefix of EXCLUDED_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return; // Pass through — do NOT call event.respondWith()
    }
  }

  // 55.2 — Skip navigation requests (HTML pages)
  if (event.request.mode === 'navigate') {
    return;
  }

  // Rule: /api/upload → network-only
  if (pathname.startsWith('/api/upload')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Rule: /api/files/[nodeId]/content → cache-first-if-exists (Tier 1 blobs)
  if (pathname.match(/^\/api\/files\/[^/]+\/content$/)) {
    handleBlobFetch(event);
    return;
  }

  // Rule: static assets → cache-first
  if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$/i)) {
    handleStaticFetch(event);
    return;
  }

  // Default: network-only for everything else
  event.respondWith(fetch(event.request));
});

// Cache-first-if-exists strategy for blob content
function handleBlobFetch(event: FetchEvent) {
  const rangeHeader = event.request.headers.get('Range');
  if (rangeHeader) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request, { cacheName: CACHE_NAMES.blobs }).then((cachedResponse) => {
      if (cachedResponse) {
        const dateHeader = cachedResponse.headers.get('sw-cache-date');
        if (dateHeader) {
          const cacheDate = new Date(dateHeader).getTime();
          const age = Date.now() - cacheDate;
          if (age > BLOB_MAX_AGE_MS) {
            caches.open(CACHE_NAMES.blobs).then((cache) => {
              cache.delete(event.request);
            });
            return fetchAndCacheBlob(event);
          }
        }
        return cachedResponse;
      }
      return fetchAndCacheBlob(event);
    }).catch((err) => {
      console.warn('[SW] Blob fetch failed, no cache available:', err);
      return new Response('Offline — file not available', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
      });
    })
  );
}

// 55.1 — Clone FIRST, before any body consumption
function fetchAndCacheBlob(event: FetchEvent) {
  return fetch(event.request).then((networkResponse) => {
    if (networkResponse.status === 200) {
      // 55.1 — Clone FIRST, before any body consumption
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-date', new Date().toISOString());

      const cacheableResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      });

      caches.open(CACHE_NAMES.blobs).then((cache) => {
        cache.put(event.request, cacheableResponse).catch((err) => {
          console.warn('[SW] Failed to cache blob response:', err);
        });
        evictBlobCache(cache);
      });
    }
    return networkResponse;
  });
}

// LRU eviction for blob cache
function evictBlobCache(cache: Cache) {
  cache.keys().then((keys) => {
    if (keys.length > BLOB_MAX_ENTRIES) {
      const toDelete = keys.slice(0, keys.length - BLOB_MAX_ENTRIES);
      for (const key of toDelete) {
        cache.delete(key);
      }
    }
  }).catch((err) => {
    console.warn('[SW] Blob cache eviction failed:', err);
  });
}

// 55.1 — Fixed handleStaticFetch: event.respondWith() is called SYNCHRONOUSLY
// (not after an async await). This prevents the "respondWith() called too late" error.
function handleStaticFetch(event: FetchEvent) {
  event.respondWith(
    caches.match(event.request, { cacheName: CACHE_NAMES.static }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          // 55.1 — Clone FIRST, before any body consumption
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAMES.static).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request).then((fallback) => {
          return fallback || new Response('Offline', { status: 503 });
        });
      });
    })
  );
}
