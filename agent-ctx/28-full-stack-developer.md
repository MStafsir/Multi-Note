---
Task ID: 28
Agent: full-stack-developer
Task: Module 28 — Data Export, Import & Portability

Work Log:
- Installed `unzipper` and `@types/unzipper` dependencies for ZIP extraction in import flow
- Created `/src/lib/tiptap-to-md.ts` — Tiptap ProseMirror JSON to Markdown serializer:
  - Handles headings (h1-h6), paragraphs, bold, italic, strikethrough, lists (bullet, ordered, task)
  - Code blocks with language annotation, blockquotes, tables, images, horizontal rules, hard breaks
  - Inline marks: bold, italic, strikethrough, code, links, underline (HTML fallback), highlight, subscript/superscript
  - Produces clean Markdown preserving main formatting without loss
- Created `/src/lib/md-to-tiptap.ts` — Markdown to Tiptap ProseMirror JSON parser:
  - Parses standard Markdown: headings, bold, italic, strikethrough, inline code, links, images
  - Lists (bullet, ordered, task with checkbox), code blocks, blockquotes, tables, horizontal rules
  - Generates valid ProseMirror JSON structure that TiptapEditor can render
  - Used for import functionality (auto-convert .md files to notes)
- Created `/src/app/api/export/route.ts` — POST endpoint for data export:
  - Auth required (x-user-id from middleware)
  - Queries all non-deleted nodes for user (files, folders, notes with metadata/content)
  - Builds folder path hierarchy mapping (handles any nesting depth)
  - For files: copies originals from /download/uploads/{userId}/ into ZIP
  - For notes: converts content_json to Markdown via tiptap-to-md.ts
  - For folders: creates directory structure in ZIP
  - Generates ZIP using archiver library with compression level 6
  - Creates a temporary Node (type=file) with FileMetadata pointing to ZIP
  - Creates NodeShare with UUID shareLinkToken and 24h expiry for download link
  - Returns { success, data: { downloadLink, expiresAt, totalNodes, folders, files, notes, zipSizeBytes } }
  - Includes export-metadata.json in ZIP with full export details
- Created `/src/app/api/export/[token]/route.ts` — GET endpoint for download:
  - Public route (no auth — token-based access via middleware bypass)
  - Validates shareLinkToken and checks expiry (410 Gone if expired)
  - Streams ZIP file as download response (Content-Type: application/zip)
- Created `/src/app/api/import/route.ts` — POST endpoint for data import:
  - Auth required (x-user-id from middleware)
  - Accepts multipart form data with ZIP file upload + optional parentId target
  - Extracts ZIP using unzipper library, processes entries depth-first (directories before files)
  - For .md files: reads content, converts via md-to-tiptap.ts, creates Note node (without .md extension)
  - For other files: saves to /download/uploads/{userId}/, creates File node with metadata + initial FileVersion
  - For folders: creates Folder nodes matching directory structure
  - Skips export-metadata.json (our own metadata file)
  - Maps relative paths to nodeIds for building hierarchy during import
  - MIME type detection from file extension mapping
  - Returns { success, data: { imported: { folders, files, notes } } }
- Created `/src/app/api/account/delete/route.ts` — DELETE endpoint for GDPR compliance:
  - Auth required, requires explicit confirmation body { confirm: true, password: "..." }
  - Verifies password matches user's stored hash
  - HARD DELETE (not soft-delete) per right-to-be-forgotten principle:
    1. Deletes all physical files from storage + all FileVersion storage files
    2. Deletes entire /download/uploads/{userId}/ directory (catches orphaned files)
    3. Deletes Tag records owned by user
    4. Deletes all Node records (cascade: FileMetadata, NoteContent, NodeShare, NodeTag, FileVersion, NoteRevision)
    5. Deletes ActivityLog records by actorId
    6. Deletes CalculationHistory records
    7. Deletes Notification records
    8. Deletes NotificationPreference record
    9. Deletes Profile record
    10. Deletes Session records
    11. Deletes Account records (OAuth)
    12. Deletes User record itself
- Updated `/src/middleware.ts`:
  - Added export/download route as public (GET /api/export/[token] — token-based access)
  - Added /api/export (POST), /api/import, /api/account to protected route list
  - Added matcher patterns for new routes
- Created `/src/components/settings/data-portability.tsx` — UI component with:
  - "Export My Data" card: button → progress → download link with 24h expiry info + stats
  - "Import Data" card: Dialog with file picker → progress → result counts
  - "Delete My Account" card: AlertDialog with password input + "DELETE" confirmation text
  - Responsive design, 44px touch targets, proper accessibility
- Integrated settings into `/src/components/workspace/workspace-layout.tsx`:
  - Added "Settings" option with Settings icon to user dropdown menu
  - Added Dialog wrapping DataPortabilitySettings component
  - Settings accessible from user avatar dropdown in header
- Lint check passes with zero errors
- Dev server serving correctly (200 status on /, 401 on protected export route)

Stage Summary:
- Complete data portability system: export (ZIP with files + Markdown notes), import (ZIP with .md auto-convert), GDPR-compliant account deletion
- Tiptap-to-Markdown serializer and Markdown-to-Tiptap parser for bidirectional note conversion
- Export generates ZIP with folder structure preserved, download link with 24h expiry
- Import supports generic ZIP folder-structure import with Markdown auto-detection
- Delete account performs hard-delete of ALL user data (right-to-be-forgotten)
- Settings dialog accessible from user menu dropdown in workspace header
- All lint checks pass, dev server verified working
