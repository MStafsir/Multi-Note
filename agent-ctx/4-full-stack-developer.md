# Task 4 - Agent: full-stack-developer
# Modul 54 — Preview Delivery Mode Bifurcation

## Work Record

### Files Modified
1. **src/components/workspace/content-area.tsx** — Updated double-click handler for tier-based routing
2. **src/app/view/[nodeId]/page.tsx** — New server component with auth validation
3. **src/components/preview/dedicated-viewer.tsx** — New client component for dedicated viewer rendering

### Files NOT Modified (per task constraint)
- src/components/preview/file-preview.tsx — stays as-is for Tier 1 inline overlay
- src/components/preview/file-preview-modal.tsx — stays as-is for Tier 1 inline overlay

### Implementation Details

#### 54.1-54.3: content-area.tsx double-click handler bifurcation
- Added `import { getPreviewTier } from '@/lib/mime-icons'`
- Modified `handleItemDoubleClick`:
  - Tier 1 (`tier1_native`): opens FilePreviewModal (existing behavior, unchanged)
  - Tier 2/3 (`tier2_client`/`tier3_server`): `window.open('/view/' + node.id, '_blank')`
- Same-origin, same-app — session automatically carries over

#### 54.4-54.5: /app/view/[nodeId]/page.tsx (Server Component)
- `getServerSession(authOptions)` — redirects to '/' if no session
- `checkNodeAccess(userId, nodeId, 'view')` — 403 if access denied
- DB lookup: `db.node.findUnique({ where: { id: nodeId }, include: { metadata: true } })`
- 404 responses for: not found, not file type, soft-deleted, missing metadata
- Tier 1 guard: if file is Tier 1, shows message to go back to workspace for inline preview
- Passes all data as props to `<DedicatedViewer />` client component

#### 54.5: dedicated-viewer.tsx (Client Component)
- DOCX: `import('docx-preview')` → `renderAsync()` with mammoth fallback
- XLSX: `import('xlsx')` → SheetJS client-side parse → SpreadsheetPreview
- PPTX: `fetch('/api/preview/[nodeId]')` → PresentationPreview slides
- All heavy libs dynamically imported (no SSR issues)

#### 54.6: Minimal Toolbar
- Back/close: ArrowLeft button → `window.close()` if `window.opener` exists, `router.back()` fallback
- File name: truncated, with type-specific icon (blue/emerald/orange)
- Size + mime label
- Download: links to `/api/files/[nodeId]/content?download=true`

### Lint Status
- `bun run lint` → clean (no errors)

### Dev Server
- Running on port 3000, Ready in 1953ms
