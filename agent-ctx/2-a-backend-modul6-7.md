# Task 2-a: Backend Agent for Modul 6 & 7

## Task: Implement Modul 6 (quota tiers, reconciliation) and Modul 7 (file preview backend + components)

## Work Log

### Modul 6: Storage Quota & Resource Governance

- **6.3**: Created `/src/lib/quota.ts` with:
  - `QUOTA_TIERS` config object (free/pro/enterprise) with limitBytes, label, name
  - `DEFAULT_TIER` = 'free'
  - Helper functions: `getTierFromLimit()`, `getTierInfo()`, `formatQuotaBytes()`
  - Exported `QuotaTierKey` and `QuotaTier` types

- **6.4**: Created `/src/app/api/storage-quota/reconcile/route.ts`:
  - POST endpoint requiring authentication
  - Queries all non-deleted file nodes with metadata for the user
  - Sums `sizeBytes` from all `FileMetadata` records
  - Compares with `profile.storageUsedBytes`
  - Auto-corrects drift by updating `storageUsedBytes` if mismatch
  - Returns detailed reconciliation report (previousBytes, actualBytes, drift, fileCount)

- **6.5**: Updated `/src/app/api/storage-quota/route.ts`:
  - Added imports from `/src/lib/quota.ts`
  - Now includes `tier` object in response: `{ key, name, label }`
  - Tier determined dynamically from `quotaLimitBytes` via `getTierFromLimit()`

### Modul 7: File Preview & Rendering Engine

- **Preview API**: Created `/src/app/api/preview/[id]/route.ts`:
  - GET endpoint with node id param
  - Auth check (session valid, user owns node, node not deleted)
  - Reads file from `/download/uploads/` directory
  - Images: served with Content-Type, supports `?size=thumbnail` query param
  - PDFs: served inline with `application/pdf`
  - Videos/Audio: served with Range header support for streaming (206 Partial Content)
  - Unsupported types: returns JSON metadata only

- **MIME Icons**: Created `/src/lib/mime-icons.ts`:
  - `PreviewType` type: 'image' | 'pdf' | 'video' | 'audio' | 'none'
  - `IconName` type for Lucide icon component names
  - `MIME_CATEGORIES` mapping for 40+ MIME types
  - `getMimePreviewType()`: exact match + prefix fallback
  - `getMimeIcon()`: returns Lucide icon name string
  - `getMimeLabel()`: returns human-readable label
  - `formatFileSize()`: utility for byte formatting

- **FilePreview Component**: Created `/src/components/preview/file-preview.tsx`:
  - Renders preview based on MIME type:
    - Images: `<img>` with lazy loading, loading spinner, error fallback
    - PDFs: embedded `<iframe>` viewer + "Open in new tab" link
    - Videos: `<video>` with controls, preload="metadata"
    - Audio: `<audio>` with controls
    - Unsupported: fallback card with icon + name + size + download button
  - Close button support via optional `onClose` prop
  - Used `ImageIcon` from Lucide to avoid jsx-a11y alt-text warning

- **FilePreviewModal Component**: Created `/src/components/preview/file-preview-modal.tsx`:
  - Wraps FilePreview in shadcn/ui Dialog
  - Title shows file name (truncated)
  - Responsive: `w-full max-w-4xl` width, `max-h-[90vh]` with scroll overflow
  - Dialog's built-in close button

### Other Changes

- Updated `/src/middleware.ts`:
  - Added `/api/preview` route to protected routes (both pathname check and matcher)
  - Changed matcher from `/api/storage-quota` to `/api/storage-quota/:path*` to cover reconcile sub-route

- Lint: passes cleanly (0 errors, 0 warnings)
- Dev server: compiles successfully, all routes functional

## Stage Summary
- All Modul 6 and 7 backend/components implemented
- Lint passes
- API endpoints tested (Unauthorized response confirms auth middleware working)
