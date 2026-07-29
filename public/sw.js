// ============================================================
// MODUL 53: Service Worker — Vanilla implementation
// Replaces Serwist-based SW which failed script evaluation.
// Uses ONLY standard ServiceWorker global scope APIs
// (no window/document dependencies, no complex bundling).
//
// Features:
//   - Cache-first-if-exists for /api/files/[nodeId]/content (Tier 1 blobs)
//     Range requests → skip cache, always network (video/audio seeking)
//     Only cache 200 (Full Content) responses — NOT 206 (Partial Content)
//   - /api/upload → network-only (mutations must hit server)
//   - Static assets → cache-first (precache on install)
// ============================================================

var CACHE_NAMES = {
  blobs: 'preview-blobs-v2',
  static: 'static-v2',
};

var BLOB_MAX_ENTRIES = 200;
var BLOB_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

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

// Fetch handler: routing based on URL pattern
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

  // Default: network-first for everything else (API calls, HTML pages, etc.)
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request).then(function(cached) {
        return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
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
function fetchAndCacheBlob(event) {
  return fetch(event.request).then(function(networkResponse) {
    // Only cache 200 (Full Content) responses — NOT 206 (Partial Content)
    if (networkResponse.status === 200) {
      var responseToCache = networkResponse.clone();
      var headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-date', new Date().toISOString());

      caches.open(CACHE_NAMES.blobs).then(function(cache) {
        // Store in cache asynchronously — don't block the response
        var cacheableResponse = new Response(responseToCache.body, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: headers,
        });
        cache.put(event.request, cacheableResponse).catch(function(err) {
          console.warn('[SW] Failed to cache blob response:', err);
        });
        // LRU eviction: if cache has too many entries, delete oldest
        evictBlobCache(cache);
      });
    }
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
function handleStaticFetch(event) {
  event.respondWith(
    caches.match(event.request, { cacheName: CACHE_NAMES.static }).then(function(cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(function(networkResponse) {
        if (networkResponse.status === 200) {
          // Clone MUST happen synchronously before the body is consumed
          // by the async caches.open() promise — otherwise clone() fails
          var responseToCache = networkResponse.clone();
          caches.open(CACHE_NAMES.static).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(function() {
        return caches.match(event.request).then(function(fallback) {
          return fallback || new Response('Offline', { status: 503 });
        });
      });
    })
  );
}
