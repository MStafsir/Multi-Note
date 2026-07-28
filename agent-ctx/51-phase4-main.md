# Task 51-phase4 — Modul 51: Offline-First Local Cache Layer

## Summary
Implemented complete offline-first local cache layer for the Next.js project, covering IndexedDB caching, Service Worker cache strategies, offline-disabling for uploads, and offline message support in file previews.

## Files Created
- `src/lib/preview-cache.ts` — IndexedDB cache layer with idb library (init, get, set, touch, evict, quota check, clear, delete, revalidate)
- `src/hooks/use-preview-cache.ts` — React hook for offline-first cache retrieval flow (Tier 2/3 only)

## Files Modified
- `src/app/sw.ts` — Extended Service Worker with cache-first-if-exists for /api/files/[nodeId]/content (Tier 1 blobs)
- `src/components/upload/upload-zone.tsx` — Disabled upload when offline (toast + drag overlay message)
- `src/components/workspace/content-area.tsx` — Added OfflineBadge + checksumSha256 state propagation
- `src/components/preview/file-preview-modal.tsx` — Added checksumSha256 prop
- `src/components/preview/file-preview.tsx` — Integrated usePreviewCache hook for DOCX/XLSX/PPTX with offline message + cache badge

## Key Implementation Details
- IndexedDB database: 'file-preview-cache' v1, two object stores (rendered-previews + cache-metadata)
- LRU eviction at 15% quota cap using navigator.storage.estimate()
- Service Worker: CacheFirst strategy with ExpirationPlugin (200 entries, 30 days)
- Range requests skip cache (video/audio seeking)
- Only 200 (Full Content) responses cached, NOT 206 (Partial Content)
- Offline message: "File ini belum pernah dibuka saat online, tidak tersedia offline"
- Revalidation on reconnect: HEAD-checks all cached entries, evicts stale/revoked/deleted
- checksumSha256 propagated through: TreeNode → content-area → FilePreviewModal → FilePreview → usePreviewCache

## Lint Status
- All changes pass ESLint clean
- App accessible (HTTP 200)
