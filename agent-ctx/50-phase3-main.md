# Task 50-phase3 — Client-side preview components (3-tier rendering refactor)

## Summary
Implemented Phase 3 of Modul 50-51: rewrote the FilePreview component to use the new 3-tier rendering system, created supporting components (OpenWithDropdown, OfflineBadge, useOnlineStatus hook).

## Files Created
- `src/hooks/use-online-status.ts` — Simple hook returning {isOnline, isOffline}
- `src/components/ui/offline-badge.tsx` — Badge showing online (green pulse dot) or offline (orange/red badge with WifiOff)
- `src/components/preview/open-with-dropdown.tsx` — DropdownMenu with Download + MS Office URI items (disabled with tooltip)

## Files Modified
- `src/components/preview/file-preview.tsx` — Major refactor:
  - Removed `previewType === 'office'` block
  - Added `contentUrl = /api/files/${id}/content`
  - Tier 1: image/video/audio use contentUrl; PDF uses pdfjs-dist canvas rendering; text uses previewUrl
  - Tier 2: DocxPreview (docx-preview renderAsync + mammoth fallback); XlsxPreview (SheetJS client-side)
  - Tier 3: PptxPreview (server-side JSON → PresentationPreview)
  - All preview sections include OfflineBadge and OpenWithDropdown
- `worklog.md` — Added work record

## Key Decisions
- PDF worker URL uses jsdelivr CDN (`https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`) matching installed version 6.1.200
- DOCX preview uses docx-preview renderAsync() with container div ref, mammoth as fallback (no iframe)
- XLSX preview fetches raw bytes from contentUrl and parses client-side (no server-side JSON)
- All heavy libraries dynamically imported to avoid SSR issues
