---
Task ID: 57-60
Agent: Main Agent
Task: Modul 57-60 — Remove Google gview, fix XLSX, fix upload validation, fix PWA icons

Work Log:
- **Modul 57**: Deleted `src/app/api/files/[nodeId]/public-content/route.ts` and `src/lib/public-file-access.ts` — completely removed Google Docs Viewer (gview) integration and public-content endpoint
- **Modul 57**: Rewrote `src/components/preview/dedicated-viewer.tsx` — removed publicAccessToken prop, removed Google Docs button, all rendering is client-side (docx-preview primary, mammoth fallback, SheetJS for XLSX, pdf.js for PDF)
- **Modul 57**: Updated `src/app/view/[nodeId]/page.tsx` — removed generatePublicAccessToken call and import
- **Modul 57**: Updated `src/app/view/[nodeId]/dedicated-viewer-client.tsx` — removed publicAccessToken prop
- **Modul 57**: Updated `src/middleware.ts` — removed public-content route exception (lines 146-150)
- **Modul 57**: Added `credentials: 'same-origin'` to all fetch calls in both dedicated-viewer.tsx and file-preview.tsx
- **Modul 58**: Verified SheetJS wiring in both preview components — both have multi-sheet tab switcher, now uses `raw: false` for computed values (not formula strings), increased row limit to 200
- **Modul 59**: Rewrote upload route with resolveMimeType() — loose MIME with fallback to extension when browser sends generic MIME (application/octet-stream), preserves original filename in DB
- **Modul 60**: Fixed PWA icons — replaced JPEG-mislabeled-as-PNG files with proper PNG icons generated via sharp
- **Verified**: All references to gview/public-content/publicAccessToken removed from codebase (grep confirmed zero hits)
- **Browser tested**: DOCX opens in new tab with full content (headings, bold, italic, links), PDF renders with zoom controls, image displays correctly, no JS errors

Stage Summary:
- Google Docs Viewer (gview) completely removed — no external calls, no public token system
- All file rendering is client-side: docx-preview (primary), mammoth (fallback), SheetJS (XLSX), pdf.js (PDF)
- Upload MIME resolution now falls back to extension when browser sends generic MIME
- PWA icons are now proper PNG files
- No security regression — all file access goes through session-authenticated /api/files/[nodeId]/content
