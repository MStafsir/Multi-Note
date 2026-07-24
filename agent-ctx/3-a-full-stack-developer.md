# Task 3-a: Build Module 15+16 API routes (Version History)

## Agent: full-stack-developer

## Work Summary

### Module 15: File Version History
- **GET `/api/nodes/[id]/versions`** — List all versions sorted desc, includes totalSizeBytes for storage cost visibility (15.6)
- **POST `/api/nodes/[id]/versions`** — Non-destructive restore (15.4): creates NEW version from old content, auto-prune oldest if > 20 (15.3), updates FileMetadata.storagePath, logs activity
- **GET `/api/nodes/[id]/versions/[versionId]`** — Download specific version with proper Content-Disposition header
- **GET `/api/nodes/[id]/versions/[versionId]/diff`** — Text file diff preview (15.5): LCS-based line diff, returns structured JSON {lines: [{type, content}]}, rejects non-text files

### Module 16: Note Revision History
- **GET `/api/nodes/[id]/revisions`** — List revisions (metadata only, no contentJsonSnapshot), checkNodeAccess for view permission
- **GET `/api/nodes/[id]/revisions/[revisionId]`** — Full contentJsonSnapshot for hover preview (16.4)
- **GET `/api/nodes/[id]/revisions/[revisionId]/diff`** — Myers diff between two revisions via `compareWith` query param (16.3)
- **POST `/api/nodes/[id]/revisions/restore`** — Non-destructive restore (16.5): saves current as revision first, then updates content

### Upload Route Update
- Switched from getServerSession to x-user-id header auth
- Re-upload now creates FileVersion instead of 409 error (15.2)
- Initial upload creates FileVersion v1
- Auto-prune > 20 versions on both upload and restore

### Key Technical Details
- All routes use `x-user-id` header from middleware for auth
- Zod validation for POST body schemas
- `logActivity()` from shared activity-logger for audit trail
- BigInt serialization via `bigintToNumber()` helper
- LCS diff algorithm for both file line diff and note revision diff
- ProseMirror JSON → plain text conversion for note diffing
- Middleware already covers `/api/nodes/:path*` — all new routes protected automatically
