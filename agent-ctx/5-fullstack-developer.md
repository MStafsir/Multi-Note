# Task 5 — Module 34: Backlink & Bi-directional Note-Linking Graph

## Work Record

### Context
All 8 core target files already existed with complete implementations from prior development. My task was to validate them, fix lint errors, and create additional integration bridge files.

### Validated Existing Files (8 target files)

1. `/src/app/api/nodes/[id]/backlinks/route.ts` — GET backlinks for a note using `getBacklinkContextSnippets`, checks access via `checkNodeAccess`, marks broken/revoked links, returns `BacklinkInfoExtended` data ✅
2. `/src/app/api/graph/route.ts` — GET graph data { nodes, edges } with limit/page params, sorts by backlink count centrality, 200 node cap, pagination with hasMore flag ✅
3. `/src/lib/note-link-extractor.ts` — Recursively walks ProseMirror JSON tree, extracts NoteLinkMention nodes → { targetNodeId, targetNoteName, position }[], also has `extractContextSnippet` for ~100 char context around link ✅
4. `/src/lib/update-note-links.ts` — `updateNoteLinks(nodeId, contentJson, userId)` that parses content, deletes old NoteLink records, creates new ones (deduplicated by targetNodeId). Also includes `getBacklinkContextSnippets` helper ✅
5. `/src/components/editor/note-link-mention.tsx` — Custom Tiptap Node extension NoteLinkMentionNode (attrs: noteId, noteName, isBroken), NoteLinkAutocomplete dropdown component, createNoteLinkSuggestionPlugin ProseMirror plugin. Broken links: strikethrough + gray + "Note deleted" tooltip ✅
6. `/src/components/backlink/backlink-panel.tsx` — Collapsible section "Backlinks (X)", cards with source note name, context snippet, timestamp. Broken: strikethrough + "Deleted" badge. framer-motion expand/collapse ✅
7. `/src/components/backlink/note-graph-view.tsx` — Canvas-based force-directed graph (no external deps). requestAnimationFrame render loop. Repulsion + attraction + center gravity + damping physics. Nodes sized by backlink count. Hover tooltip. Click navigates. "Load more" if >200 nodes. Color: active=emerald, deleted=gray, broken=dotted red ✅
8. `/src/hooks/use-backlinks.ts` — `useBacklinks(nodeId)` + `useGraphData(page)` React Query hooks ✅

### Lint Fixes Applied

- **note-graph-view.tsx**: Moved `simStateRef.current.zoom/offset` assignments from render body into `useEffect([zoom, offset])` — fixes `react-hooks/refs` lint error
- **note-link-mention.tsx**: Replaced `selectedIndexRef.current` read-during-render with `useState(selectedIndex)` + `clampedIndex` computed value. Replaced `onMouseEnter` ref update with `setSelectedIndex(index)`. Removed `useEffect` that called `setState` — fixes `react-hooks/refs` and `react-hooks/set-state-in-effect` lint errors

### New Files Created (5 integration bridge files)

1. **`/src/app/api/note-links/route.ts`** — POST endpoint to trigger `updateNoteLinks` from client side. Accepts `{ nodeId, contentJson? }`. Verifies node exists, is a note, user has edit access. If contentJson not provided, reads from database. Returns linkCount. Wrapped with `traceHandler`.

2. **`/src/types/backlink-augmented.ts`** — Type augmentation file extending `BacklinkInfo` with `isBroken` and `accessRevoked` fields that the API returns but the base type doesn't include. Also defines `BacklinkResponse`, `GraphResponse`, `NoteLinkUpdateResponse`.

3. **`/src/hooks/use-note-link-update.ts`** — React Query mutation hook for POST `/api/note-links`. Invalidates backlinks, graph, and nodes queries on success. Silent failure (link updates are supplementary).

4. **`/src/components/editor/tiptap-editor-enhanced.tsx`** — Enhanced TiptapEditor with NoteLinkMentionNode + NoteLinkAutocomplete + BacklinkPanel. Includes [[ trigger detection, autocomplete dropdown, note link navigation, post-save link update trigger. Drop-in replacement for the base TiptapEditor.

5. **`/src/components/workspace/note-editor-with-backlinks.tsx`** — Integration wrapper combining NoteEditor (lazy load + offline) with BacklinkPanel + NoteGraphView. Has Editor/Graph toggle tabs. Uses dynamic import for TiptapEditorEnhanced. Post-save triggers noteLinkUpdate mutation. Full-featured Module 34 integration point.

### Integration Steps Required (cannot modify existing files)

The following changes to existing files are needed for full integration (documented but NOT applied):

1. **`/src/middleware.ts`** — Add `pathname.startsWith('/api/note-links')` to protected routes whitelist and matcher config
2. **`/src/components/workspace/content-area.tsx`** — Import and render `NoteEditorWithBacklinks` instead of `NoteEditor` when viewing a note
3. **`/src/app/api/nodes/[id]/route.ts`** — Add `import { updateNoteLinks }` and call `updateNoteLinks(id, validated.contentJson, session.user.id)` in the PATCH handler after note content update
4. **`/src/types/index.ts`** — Add `isBroken: boolean` and `accessRevoked?: boolean` fields to `BacklinkInfo` type (or keep using augmented types from backlink-augmented.ts)

### Lint & Server Status
- Lint: 0 errors, 0 warnings ✅
- Dev server: Running on port 3000 ✅
- API route `/api/note-links` responds with "Unauthorized" for unauthenticated requests ✅
