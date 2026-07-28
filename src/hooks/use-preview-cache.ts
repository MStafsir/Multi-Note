'use client';

// ============================================================
// MODUL 51: Preview Cache Retrieval Hook (51.3-51.4)
// Implements offline-first retrieval flow for Tier 2/3 previews:
//   - Online + Tier 2/3: check cache → match → return cached content
//   - Offline + Tier 2/3: check cache → match → return cached content
//   - Offline + no cache: show offline message
//   - Tier 1: handled by Service Worker, no IndexedDB involvement
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  getCachedPreview,
  setCachedPreview,
  touchCacheEntry,
  revalidateCacheOnReconnection,
  type CacheEntry,
} from '@/lib/preview-cache';
import { type PreviewTier } from '@/lib/mime-icons';
import { useOnlineStatus } from '@/hooks/use-online-status';

interface UsePreviewCacheOptions {
  nodeId: string;
  mimeType: string;
  checksumSha256: string | null;
  previewTier: PreviewTier;
}

interface UsePreviewCacheResult {
  cachedContent: string | null; // HTML or JSON string from cache
  isFromCache: boolean;
  isLoadingCache: boolean;
  offlineMessage: string | null; // Set if offline + no cache
  triggerBackgroundCache: (content: string) => Promise<void>;
}

const OFFLINE_NO_CACHE_MSG =
  'File ini belum pernah dibuka saat online, tidak tersedia offline';

export function usePreviewCache({
  nodeId,
  mimeType,
  checksumSha256,
  previewTier,
}: UsePreviewCacheOptions): UsePreviewCacheResult {
  const { isOnline, isOffline } = useOnlineStatus();
  const [cachedContent, setCachedContent] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isLoadingCache, setIsLoadingCache] = useState(true);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);

  // Revalidate cache on reconnect
  useEffect(() => {
    if (isOnline) {
      // Run revalidation in background — non-blocking
      revalidateCacheOnReconnection().catch((err) => {
        console.warn('[use-preview-cache] Revalidation failed:', err);
      });
    }
  }, [isOnline]);

  // Cache retrieval flow
  useEffect(() => {
    let cancelled = false;

    const checkCache = async () => {
      // Tier 1: Service Worker handles caching — no IndexedDB involvement
      if (previewTier === 'tier1_native') {
        if (!cancelled) {
          setCachedContent(null);
          setIsFromCache(false);
          setIsLoadingCache(false);
          setOfflineMessage(null);
        }
        return;
      }

      // Tier 2/3: check IndexedDB cache
      if (!checksumSha256) {
        // No checksum available — can't cache
        if (!cancelled) {
          setCachedContent(null);
          setIsFromCache(false);
          setIsLoadingCache(false);
          if (isOffline) {
            setOfflineMessage(OFFLINE_NO_CACHE_MSG);
          } else {
            setOfflineMessage(null);
          }
        }
        return;
      }

      try {
        const entry: CacheEntry | null = await getCachedPreview(
          nodeId,
          checksumSha256
        );

        if (cancelled) return;

        if (entry) {
          // Cache hit — return cached content regardless of online/offline status
          setCachedContent(entry.renderedContent);
          setIsFromCache(true);
          setIsLoadingCache(false);
          setOfflineMessage(null);

          // Touch entry for LRU (already done in getCachedPreview, but ensure it)
          await touchCacheEntry(nodeId, checksumSha256);
        } else {
          // Cache miss
          setCachedContent(null);
          setIsFromCache(false);
          setIsLoadingCache(false);

          if (isOffline) {
            // Offline + no cache → show message
            setOfflineMessage(OFFLINE_NO_CACHE_MSG);
          } else {
            // Online + no cache → component will fetch from network
            setOfflineMessage(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[use-preview-cache] Cache lookup failed:', err);
          setCachedContent(null);
          setIsFromCache(false);
          setIsLoadingCache(false);
          if (isOffline) {
            setOfflineMessage(OFFLINE_NO_CACHE_MSG);
          }
        }
      }
    };

    checkCache();
    return () => { cancelled = true; };
  }, [nodeId, checksumSha256, previewTier, isOffline, mimeType]);

  /**
   * After successful network fetch, call this to store the rendered result
   * in IndexedDB for future offline access.
   */
  const triggerBackgroundCache = useCallback(
    async (content: string) => {
      // Only cache Tier 2/3 content
      if (previewTier === 'tier1_native') return;
      if (!checksumSha256) return;

      const tier: 'tier2_client' | 'tier3_server' =
        previewTier === 'tier2_client' ? 'tier2_client' : 'tier3_server';

      try {
        await setCachedPreview({
          key: `${nodeId}:${checksumSha256}`,
          nodeId,
          checksumSha256,
          tier,
          mimeType,
          renderedContent: content,
          sizeBytes: new Blob([content]).size,
          lastAccessedAt: Date.now(),
          createdAt: Date.now(),
        });
      } catch (err) {
        console.warn('[use-preview-cache] Background cache write failed:', err);
      }
    },
    [nodeId, checksumSha256, previewTier, mimeType]
  );

  return {
    cachedContent,
    isFromCache,
    isLoadingCache,
    offlineMessage,
    triggerBackgroundCache,
  };
}
