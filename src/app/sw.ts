// ============================================================
// MODUL 51: Service Worker — Serwist + custom cache strategies
// 51.1 — Cache-first-if-exists for /api/files/[nodeId]/content (Tier 1 blobs)
//   - Range requests → skip cache, always network (video/audio seeking)
//   - No Range + cache match → return cached Response
//   - No Range + no cache match → fetch from network, cache 200 Response, return it
//   - DO NOT cache 206 (Partial Content) responses — only 200 (Full Content)
//   - Cache name: 'preview-blobs-v1', max age: 30 days, max entries: 200
// Existing rules:
//   /api/nodes → staleWhileRevalidate
//   /api/upload → networkOnly
// ============================================================

import type { PrecacheEntry } from 'serwist';
import { Serwist, CacheFirst, ExpirationPlugin } from 'serwist';

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (string | PrecacheEntry)[];
  }
}

// Cache name for Tier 1 blob content (images, video, audio, PDF raw bytes)
const BLOB_CACHE_NAME = 'preview-blobs-v1';

// Cache-first strategy for /api/files/[nodeId]/content — Tier 1 blobs
// 30-day max age, 200 max entries, cache-only for non-Range requests
const blobCacheStrategy = new CacheFirst({
  cacheName: BLOB_CACHE_NAME,
  plugins: [
    new ExpirationPlugin({
      maxEntries: 200,
      maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
    }),
  ],
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
});

// Existing rule: /api/nodes → staleWhileRevalidate
serwist.addPrecacheRule({
  url: /\/api\/nodes/,
  strategy: 'staleWhileRevalidate',
});

// Existing rule: /api/upload → networkOnly
serwist.addPrecacheRule({
  url: /\/api\/upload/,
  strategy: 'networkOnly',
});

// Register Serwist event listeners first
serwist.addEventListeners();

// Custom fetch handler for Tier 1 blob content (/api/files/[nodeId]/content)
// This runs AFTER Serwist's default handling — if Serwist didn't handle it,
// we intercept it here with our cache-first-if-exists strategy.
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  // Only handle /api/files/[nodeId]/content requests
  if (!url.pathname.match(/^\/api\/files\/[^/]+\/content$/)) {
    return; // Let other handlers deal with it
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Range request → skip cache, always go to network (video/audio seeking)
  const rangeHeader = event.request.headers.get('Range');
  if (rangeHeader) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first-if-exists strategy for non-Range requests
  event.respondWith(
    (async () => {
      try {
        // Check Cache API for matching URL
        const cachedResponse = await caches.match(event.request, {
          cacheName: BLOB_CACHE_NAME,
        });

        if (cachedResponse) {
          // Cache hit — return cached response
          return cachedResponse;
        }

        // Cache miss — fetch from network
        const networkResponse = await fetch(event.request);

        // Only cache 200 (Full Content) responses — NOT 206 (Partial Content)
        if (
          networkResponse.status === 200 &&
          networkResponse.headers.get('Content-Length')
        ) {
          // Clone the response before caching (response can only be consumed once)
          const responseToCache = networkResponse.clone();

          // Store in cache asynchronously — don't block the response
          const cache = await caches.open(BLOB_CACHE_NAME);
          cache.put(event.request, responseToCache).catch((err) => {
            console.warn('[SW] Failed to cache blob response:', err);
          });
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
});
