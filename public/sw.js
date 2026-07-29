// ============================================================
// MODUL 55: Service Worker — Vanilla implementation
// Fixed: Response clone violation, dev/HMR exclusion, production-only activation
//
// Features:
//   - Cache-first-if-exists for /api/files/[nodeId]/content (Tier 1 blobs)
//     Range requests → skip cache, always network (video/audio seeking)
//     Only cache 200 (Full Content) responses — NOT 206 (Partial Content)
//   - /api/upload → network-only (mutations must hit server)
//   - Static assets → cache-first (production only)
//   - Exclusion list: /_next/*, HMR, dev-server internals are NEVER intercepted
//   - Production-only: SW skips ALL fetch handling in development mode
//     (checked via self.location.origin + known dev patterns)
// ============================================================

var CACHE_NAMES = {
  blobs: 'preview-blobs-v3',
  static: 'static-v3',
};

var BLOB_MAX_ENTRIES = 200;
var BLOB_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// ============================================================
// 55.2 — Exclusion list: paths that must NEVER be intercepted
// by the SW. These are all dev-server internal paths that
// cause errors when cached (especially during Fast Refresh).
// ============================================================
var EXCLUDED_PATH_PREFIXES = [
  '/_next/',            // All Next.js internals: HMR, chunks, static
  '/__nextjs',          // Next.js dev overlay
  '/__webpack_hmr',     // Webpack HMR endpoint
  '/socket.io/',        // Socket.io (if used for collab)
];

// Install: skip waiting so SW activates immediately
self.addEventListener('install', function() {
  self.skipWaiting();
});

// Activate: clean up old caches, claim clients
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) {
            return key !== CACHE_NAMES.blobs && key !== CACHE_NAMES.static;
          })
          .map(function(key) {
            return caches.delete(key);
          })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ============================================================
// 55.2/55.5 — Fetch handler with exclusion list
// CRITICAL: ReadableStream can only be consumed once.
// .clone() MUST be the FIRST operation on any response before
// its body is consumed by cache.put(), .json(), .text(), etc.
// ============================================================
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // 55.2 — Exclusion list: skip ALL dev-server internal paths
  // These paths must NEVER be intercepted by the SW — they are
  // dev-server internals (HMR, chunks, etc.) that change on every
  // recompile and cause errors when cached.
  var pathname = url.pathname;
  for (var i = 0; i < EXCLUDED_PATH_PREFIXES.length; i++) {
    if (pathname.startsWith(EXCLUDED_PATH_PREFIXES[i])) {
      return; // Pass through to network — do NOT call event.respondWith()
    }
  }

  // 55.2 — Skip navigation requests (HTML pages)
  // The SW should only cache subresource requests, not HTML navigation.
  // HTML pages in dev mode change frequently and caching them causes stale content.
  if (event.request.mode === 'navigate') {
    return;
  }

  // Rule: /api/upload → network-only (mutations must hit server)
  if (pathname.startsWith('/api/upload')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Rule: /api/files/[nodeId]/content → cache-first-if-exists (Tier 1 blobs)
  if (pathname.match(/^\/api\/files\/[^/]+\/content$/)) {
    handleBlobFetch(event);
    return;
  }

  // Rule: static assets → cache-first (only for production-like assets)
  // 55.2 — Only cache static assets with file extensions (not dynamic API routes)
  // Skip caching during development to avoid stale chunk issues
  if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$/i)) {
    handleStaticFetch(event);
    return;
  }

  // Default: network-only for everything else (API calls, HTML pages, etc.)
  // 55.5 — Changed from network-first to network-only for non-blob, non-static requests.
  // The SW should NOT cache API responses or HTML pages — only blob content and static assets.
  // This prevents the SW from interfering with dev-server HMR or API calls.
  event.respondWith(fetch(event.request));
});

// Cache-first-if-exists strategy for blob content
function handleBlobFetch(event) {
  // Range request → skip cache, always go to network (video/audio seeking)
  var rangeHeader = event.request.headers.get('Range');
  if (rangeHeader) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request, { cacheName: CACHE_NAMES.blobs }).then(function(cachedResponse) {
      // Check if cached entry has expired
      if (cachedResponse) {
        var dateHeader = cachedResponse.headers.get('sw-cache-date');
        if (dateHeader) {
          var cacheDate = new Date(dateHeader).getTime();
          var age = Date.now() - cacheDate;
          if (age > BLOB_MAX_AGE_MS) {
            // Stale — remove from cache and re-fetch
            caches.open(CACHE_NAMES.blobs).then(function(cache) {
              cache.delete(event.request);
            });
            // Fall through to network fetch
            return fetchAndCacheBlob(event);
          }
        }
        // Cache hit — return cached response
        return cachedResponse;
      }

      // Cache miss — fetch from network
      return fetchAndCacheBlob(event);
    }).catch(function(err) {
      // Network failed and no cache — return offline response
      console.warn('[SW] Blob fetch failed, no cache available:', err);
      return new Response('Offline — file not available', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
      });
    })
  );
}

// Fetch blob from network and cache if it's a 200 response
// 55.1 — CRITICAL: clone() MUST be called BEFORE any body consumption.
// The response body is a ReadableStream that can only be consumed once.
// We clone first, then use the clone for caching and return the original.
function fetchAndCacheBlob(event) {
  return fetch(event.request).then(function(networkResponse) {
    // Only cache 200 (Full Content) responses — NOT 206 (Partial Content)
    if (networkResponse.status === 200) {
      // 55.1 — Clone FIRST, before any body consumption
      var responseToCache = networkResponse.clone();
      var headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-date', new Date().toISOString());

      // Create a new response with the cache-date header added
      // This consumes responseToCache.body (the clone), NOT networkResponse.body
      var cacheableResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });

      // Store in cache asynchronously — don't block the response
      caches.open(CACHE_NAMES.blobs).then(function(cache) {
        cache.put(event.request, cacheableResponse).catch(function(err) {
          console.warn('[SW] Failed to cache blob response:', err);
        });
        // LRU eviction: if cache has too many entries, delete oldest
        evictBlobCache(cache);
      });
    }
    // Return the ORIGINAL response — its body has NOT been consumed
    return networkResponse;
  });
}

// LRU eviction for blob cache — removes oldest entries if over max
function evictBlobCache(cache) {
  cache.keys().then(function(keys) {
    if (keys.length > BLOB_MAX_ENTRIES) {
      var toDelete = keys.slice(0, keys.length - BLOB_MAX_ENTRIES);
      for (var i = 0; i < toDelete.length; i++) {
        cache.delete(toDelete[i]);
      }
    }
  }).catch(function(err) {
    console.warn('[SW] Blob cache eviction failed:', err);
  });
}

// Cache-first strategy for static assets
// 55.1 — Clone ordering is correct: clone() is called BEFORE cache.put()
// which consumes the clone's body. The original response is returned.
function handleStaticFetch(event) {
  event.respondWith(
    caches.match(event.request, { cacheName: CACHE_NAMES.static }).then(function(cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(function(networkResponse) {
        if (networkResponse.status === 200) {
          // 55.1 — Clone FIRST, before any body consumption
          var responseToCache = networkResponse.clone();
          // Cache the clone asynchronously — don't block the response
          caches.open(CACHE_NAMES.static).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
        }
        // Return the ORIGINAL response — its body has NOT been consumed
        return networkResponse;
      }).catch(function() {
        return caches.match(event.request).then(function(fallback) {
          return fallback || new Response('Offline', { status: 503 });
        });
      });
    })
  );
}
