# Task 3-b: Backend API Routes for Module 17 (Trash & Restore) and Module 18 (Bulk Operations)

## Work Done

### Module 17: Trash & Restore API

1. **`/src/app/api/trash/route.ts`** — GET: List all trashed nodes
   - Finds nodes where ownerId = userId AND deletedAt IS NOT NULL
   - Sorted by deletedAt descending
   - Includes node metadata (file metadata with BigInt serialization), type, name, parentId, deletedAt
   - Returns `{ success: true, data: { nodes: [...] } }`

2. **`/src/app/api/trash/restore/route.ts`** — POST: Restore from trash
   - Body: `{ nodeId: string }` (Zod validated)
   - Sets deletedAt = null on node AND all descendants (recursive via getAllDescendants)
   - Parent validity check: if original parent was deleted/missing, restores to root with warning
   - Quota check (17.5): Before restoring, checks if restored file sizes would exceed quota → 403 if exceeded
   - Updates storage quota by incrementing storageUsedBytes
   - Logs activity with logActivity({ actionType: 'restore' })

3. **`/src/app/api/trash/purge/route.ts`** — POST: Empty trash (hard delete)
   - Body: `{ confirm: boolean, confirmText: string }` (Zod validated)
   - Must have confirm=true AND confirmText === "I understand this is permanent"
   - Hard deletes all trashed nodes: deletes storage files from disk, FileMetadata, NoteContent, FileVersions, NoteRevisions, NodeShares, NodeTags, ActivityLog references (SetNull)
   - Re-calculates storageUsedBytes after removing files for accuracy
   - Partial failure handling (18.6): continues processing when individual node fails
   - Logs activity with logActivity({ actionType: 'delete', metadata: { bulk: true, count: N } })

4. **`/src/app/api/trash/auto-purge/route.ts`** — POST: Auto-prune old items (17.3)
   - Finds nodes where deletedAt > 30 days ago
   - Hard deletes them same as purge logic (same hardDeleteNode helper)
   - Can be called manually or via scheduled task
   - Returns thresholdDays, deletedCount, freedBytes

### Module 18: Bulk Operations API

5. **`/src/app/api/nodes/bulk-delete/route.ts`** — POST: Bulk soft-delete (18.3)
   - Body: `{ nodeIds: string[] }` (Zod validated, max 100)
   - Verifies ownership, filters already-trashed nodes
   - Collects all IDs including descendants of folders (deduplicated)
   - Single batch updateMany: `WHERE id IN nodeIds AND ownerId = userId AND deletedAt = null`
   - Logs activity with bulk metadata

6. **`/src/app/api/nodes/bulk-move/route.ts`** — POST: Bulk move (18.2)
   - Body: `{ nodeIds: string[], targetFolderId: string | null }` (Zod validated)
   - Validates target folder (must be active, user-owned folder)
   - Cycle detection: target can't be descendant of any moved folder node
   - Batch updateMany for parentId update
   - Logs activity with move metadata

7. **`/src/app/api/nodes/bulk-download/route.ts`** — POST: Bulk download as ZIP (18.4)
   - Body: `{ nodeIds: string[] }` (Zod validated, max 50)
   - Uses archiver npm package for ZIP creation
   - For folders, includes all descendant files (with folder name prefix)
   - Notes exported as .json files
   - Content-Type: application/zip, Content-Disposition: attachment; filename="workspace-export.zip"
   - Streams response (archiver → buffer → NextResponse)

8. **`/src/app/api/nodes/bulk-share/route.ts`** — POST: Bulk share (18.2)
   - Body: `{ nodeIds: string[], sharedWithUserId: string, permissionLevel: 'view'|'comment'|'edit' }`
   - Creates NodeShare entries for all selected nodes
   - Partial failure handling: continues if share already exists (unique constraint)
   - Sends share_received notification via createNotification
   - Logs activity with share metadata

9. **`/src/app/api/nodes/bulk-tag/route.ts`** — POST: Bulk tag (18.2)
   - Body: `{ nodeIds: string[], tagId: string }`
   - Validates tag exists and belongs to user
   - Creates NodeTag entries, skips if already tagged (unique constraint)
   - Logs activity with tag metadata

### Infrastructure Updates

10. **Middleware** — Updated `/src/middleware.ts`:
    - Added `/api/trash` route protection in pathname check
    - Added `/api/trash/:path*` in matcher config
    - Ensures x-user-id header is set for all trash API routes

11. **Dependencies** — Installed archiver + @types/archiver for ZIP streaming

## Technical Decisions

- Used `x-user-id` header for auth (consistent with middleware pattern) instead of getServerSession
- Reused `getAllDescendants` from `@/lib/permissions` for recursive descendant lookup
- Reused `logActivity` from `@/lib/activity-logger` and `createNotification` from `@/lib/notification-sender`
- Reused `bigintToNumber` from `@/lib/bigint` for BigInt serialization
- Purge/auto-purge hard-delete logic uses per-node processing with partial failure handling
- Storage re-calculated via full reconciliation (sum of active file sizes) rather than decrement for accuracy
- Bulk-move cycle detection checks each folder's descendants against target
