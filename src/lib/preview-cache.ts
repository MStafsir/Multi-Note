// ============================================================
// MODUL 51: Offline-First Local Cache Layer — IndexedDB
// Stores rendered previews (Tier 2/3) for offline access
// Uses idb library for clean IndexedDB transactions
// ============================================================

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'file-preview-cache';
const DB_VERSION = 1;
const STORE_NAME = 'rendered-previews';
const META_STORE = 'cache-metadata';

/** Quota cap: we use at most 15% of the browser's total storage quota */
const QUOTA_CAP_RATIO = 0.15;

export interface CacheEntry {
  key: string; // `${nodeId}:${checksumSha256}`
  nodeId: string;
  checksumSha256: string;
  tier: 'tier2_client' | 'tier3_server';
  mimeType: string;
  renderedContent: string; // HTML string for docx, JSON string for xlsx/pptx
  sizeBytes: number;
  lastAccessedAt: number; // epoch ms for LRU
  createdAt: number;
}

export interface CacheMetadata {
  key: string;
  nodeId: string;
  lastAccessedAt: number;
  sizeBytes: number;
  mimeType: string;
}

let dbInstance: IDBPDatabase | null = null;

/**
 * Open (or create) the IndexedDB database for preview caching.
 * Creates two object stores: rendered-previews (full data) and cache-metadata (lightweight index).
 */
export async function initPreviewCacheDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Main store: holds full rendered content
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('nodeId', 'nodeId', { unique: false });
        store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
      }
      // Metadata store: lightweight for LRU scanning without reading full content
      if (!db.objectStoreNames.contains(META_STORE)) {
        const metaStore = db.createObjectStore(META_STORE, { keyPath: 'key' });
        metaStore.createIndex('nodeId', 'nodeId', { unique: false });
        metaStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
      }
    },
  });

  return dbInstance;
}

/**
 * Build the composite key from nodeId and checksumSha256.
 */
function buildKey(nodeId: string, checksumSha256: string): string {
  return `${nodeId}:${checksumSha256}`;
}

/**
 * Retrieve a cached preview entry by nodeId and checksum.
 * Returns null if not found or if checksum doesn't match.
 * Also touches the entry (updates lastAccessedAt) for LRU tracking.
 */
export async function getCachedPreview(
  nodeId: string,
  checksumSha256: string
): Promise<CacheEntry | null> {
  if (!checksumSha256) return null;

  const db = await initPreviewCacheDB();
  const key = buildKey(nodeId, checksumSha256);
  const entry = await db.get(STORE_NAME, key);

  if (!entry) return null;

  // Touch for LRU — update lastAccessedAt
  await touchCacheEntry(nodeId, checksumSha256);

  return entry as CacheEntry;
}

/**
 * Store a rendered preview in the cache (both full store and metadata store).
 * Also triggers LRU eviction if we're near the quota cap.
 */
export async function setCachedPreview(entry: CacheEntry): Promise<void> {
  const db = await initPreviewCacheDB();

  const now = Date.now();
  const fullEntry: CacheEntry = {
    ...entry,
    key: buildKey(entry.nodeId, entry.checksumSha256),
    lastAccessedAt: now,
    createdAt: entry.createdAt || now,
  };

  const metadata: CacheMetadata = {
    key: fullEntry.key,
    nodeId: fullEntry.nodeId,
    lastAccessedAt: now,
    sizeBytes: fullEntry.sizeBytes,
    mimeType: fullEntry.mimeType,
  };

  const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
  await Promise.all([
    tx.objectStore(STORE_NAME).put(fullEntry),
    tx.objectStore(META_STORE).put(metadata),
    tx.done,
  ]);

  // Evict if needed after adding
  await evictLRUIfNeeded();
}

/**
 * Update lastAccessedAt on an entry for LRU tracking.
 */
export async function touchCacheEntry(
  nodeId: string,
  checksumSha256: string
): Promise<void> {
  if (!checksumSha256) return;

  const db = await initPreviewCacheDB();
  const key = buildKey(nodeId, checksumSha256);
  const now = Date.now();

  const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');

  const fullEntry = await tx.objectStore(STORE_NAME).get(key);
  if (fullEntry) {
    fullEntry.lastAccessedAt = now;
    await tx.objectStore(STORE_NAME).put(fullEntry);
  }

  const metadata = await tx.objectStore(META_STORE).get(key);
  if (metadata) {
    metadata.lastAccessedAt = now;
    await tx.objectStore(META_STORE).put(metadata);
  }

  await tx.done;
}

/**
 * Check if we're at or near the storage quota cap (15% of total quota).
 * Returns { usage, quota, isNearCap }.
 */
export async function checkCacheQuota(): Promise<{
  usage: number;
  quota: number;
  isNearCap: boolean;
}> {
  // navigator.storage.estimate() is available in secure contexts
  if (!navigator.storage?.estimate) {
    // Fallback: assume unlimited quota (no eviction)
    return { usage: 0, quota: Infinity, isNearCap: false };
  }

  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage || 0;
  const quota = estimate.quota || Infinity;
  const cap = quota * QUOTA_CAP_RATIO;
  const isNearCap = usage >= cap;

  return { usage, quota, isNearCap };
}

/**
 * Get the total size (in bytes) of all entries in the preview cache.
 */
export async function getCacheSize(): Promise<number> {
  const db = await initPreviewCacheDB();
  const tx = db.transaction(META_STORE, 'readonly');
  let totalSize = 0;

  let cursor = await tx.objectStore(META_STORE).openCursor();
  while (cursor) {
    totalSize += (cursor.value as CacheMetadata).sizeBytes;
    cursor = await cursor.continue();
  }

  return totalSize;
}

/**
 * Evict oldest (least-recently-accessed) entries until we're under the quota cap.
 * LRU eviction: sort by lastAccessedAt ascending, delete oldest until under cap.
 */
export async function evictLRUIfNeeded(): Promise<void> {
  const { isNearCap, quota } = await checkCacheQuota();
  if (!isNearCap) return;

  const db = await initPreviewCacheDB();
  const cap = quota * QUOTA_CAP_RATIO;
  let currentSize = await getCacheSize();

  if (currentSize <= cap) return;

  // Scan metadata store sorted by lastAccessedAt ascending (oldest first)
  const tx = db.transaction([META_STORE, STORE_NAME], 'readwrite');
  const metaStore = tx.objectStore(META_STORE);
  const index = metaStore.index('lastAccessedAt');

  let cursor = await index.openCursor();
  while (cursor && currentSize > cap) {
    const meta = cursor.value as CacheMetadata;
    currentSize -= meta.sizeBytes;

    // Delete from both stores
    await tx.objectStore(STORE_NAME).delete(meta.key);
    await metaStore.delete(meta.key);

    cursor = await cursor.continue();
  }

  await tx.done;
}

/**
 * Delete a specific cache entry by nodeId and checksum.
 */
export async function deleteCacheEntry(
  nodeId: string,
  checksumSha256: string
): Promise<void> {
  if (!checksumSha256) return;

  const db = await initPreviewCacheDB();
  const key = buildKey(nodeId, checksumSha256);

  const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
  await Promise.all([
    tx.objectStore(STORE_NAME).delete(key),
    tx.objectStore(META_STORE).delete(key),
    tx.done,
  ]);
}

/**
 * Delete all entries in the preview cache.
 */
export async function clearPreviewCache(): Promise<void> {
  const db = await initPreviewCacheDB();
  const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
  await Promise.all([
    tx.objectStore(STORE_NAME).clear(),
    tx.objectStore(META_STORE).clear(),
    tx.done,
  ]);
}

/**
 * 51.8: Revalidate cached entries on reconnect.
 * Iterate all cache entries, HEAD-check the server for each file.
 * Delete entries where:
 *   - The file's checksum has changed (stale content)
 *   - Access to the file has been revoked (server returns 403)
 *   - The file has been deleted (server returns 404)
 *
 * This must be non-blocking: uses Promise.allSettled for parallel HEAD checks.
 * Only runs when online (caller should check navigator.onLine before invoking).
 */
export async function revalidateCacheOnReconnection(): Promise<void> {
  const db = await initPreviewCacheDB();
  const tx = db.transaction(META_STORE, 'readonly');
  const allMeta: CacheMetadata[] = await tx.objectStore(META_STORE).getAll();

  if (allMeta.length === 0) return;

  // Parallel HEAD checks — non-blocking
  const results = await Promise.allSettled(
    allMeta.map(async (meta) => {
      // HEAD request to /api/files/[nodeId]/content to check if file still exists + get headers
      const contentUrl = `/api/files/${meta.nodeId}/content`;
      const res = await fetch(contentUrl, { method: 'HEAD' });

      if (res.status === 404 || res.status === 403) {
        // File deleted or access revoked — evict from cache
        await deleteCacheEntry(meta.nodeId, meta.key.split(':')[1]);
        return { evicted: true, reason: res.status };
      }

      // Check if ETag or checksum changed
      const serverChecksum = res.headers.get('x-content-checksum') || res.headers.get('etag');
      if (serverChecksum) {
        // Clean up ETag quotes if present
        const cleanChecksum = serverChecksum.replace(/^"(.*)"$/, '$1');
        const cachedChecksum = meta.key.split(':')[1];

        if (cleanChecksum !== cachedChecksum) {
          // Content has changed — evict stale entry
          await deleteCacheEntry(meta.nodeId, cachedChecksum);
          return { evicted: true, reason: 'checksum_changed' };
        }
      }

      return { evicted: false };
    })
  );

  // Log results (non-critical)
  const evictedCount = results.filter(
    (r) => r.status === 'fulfilled' && r.value.evicted
  ).length;
  const failedCount = results.filter(
    (r) => r.status === 'rejected'
  ).length;

  if (evictedCount > 0 || failedCount > 0) {
    console.info(
      `[preview-cache] Revalidation: ${evictedCount} evicted, ${failedCount} checks failed`
    );
  }
}
