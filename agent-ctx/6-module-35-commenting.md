# Task 6 — Module 35: In-Note Threaded Commenting System

## Agent: Main Agent

## Work Record

### Files Created

**Backend API Routes:**
1. `/src/app/api/comments/route.ts` — POST create comment (with anchor_position, parent_comment_id, thread flattening for reply-to-reply), GET list comments for node (query: nodeId, includeResolved). Includes @mention processing with notification trigger.
2. `/src/app/api/comments/[id]/route.ts` — PATCH update comment content (author only) or toggle resolve/unresolve (author/owner/edit users). DELETE by author or node owner (cascade deletes replies when root is deleted).

**Frontend Components:**
3. `/src/components/comment/comment-sidebar.tsx` — Side panel with threaded comments for current note. Tabs: "Open" | "Resolved" | "All". Groups comments by thread (root + flattened replies). Resolve toggle, collapsed resolved threads expandable. Comment input form at bottom. Accepts pendingAnchorPosition from selection handler.
4. `/src/components/comment/comment-thread.tsx` — Single thread view: root comment + replies list. Reply form (max 1 level). Resolve/unresolve toggle. Author avatar + name + timestamp. "Show in note" anchor highlight button. Inline edit/delete actions.
5. `/src/components/comment/comment-input.tsx` — Input form for new comment/reply. Plain text textarea (max 2000 chars). @mention autocomplete dropdown (users from node_shares + owner). Keyboard navigation in dropdown (Arrow keys, Enter/Tab to select, Escape to close). Submit/cancel buttons. Character count display.
6. `/src/components/comment/selection-anchor-handler.tsx` — When user selects text in Tiptap editor, shows floating "💬 Add comment" button near selection. Captures ProseMirror selection coordinates (from, to, text, path) as anchor_position. Highlights anchored text with background color when sidebar is open.
7. `/src/components/comment/comment-styles.css` — CSS styles for comment anchor highlighting and sidebar custom scrollbar.

**Hooks:**
8. `/src/hooks/use-comments.ts` — useComments(nodeId, includeResolved), useCreateComment, useUpdateComment, useDeleteComment, useResolveComment, useCommentThreads, useNodeAccessibleUsers (for @mention autocomplete).
9. `/src/hooks/use-comment-collab.ts` — useCommentCollab hook connecting to comment-sync Socket.IO service on port 3004. Emits comment-create/update/resolve/delete events. Receives events from other viewers and invalidates React Query cache.

**Mini Service:**
10. `/mini-services/comment-sync-service/index.ts` — Socket.IO service on port 3004 for realtime comment sync. Handles join/leave-note-room, comment-create, comment-update, comment-resolve, comment-delete events. Broadcasts to other users in the same note room.
11. `/mini-services/comment-sync-service/package.json` — Package config for comment-sync-service.

### Design Decisions

- **Thread flattening (35.3)**: When creating a reply to a reply, the parentCommentId is automatically set to the ROOT comment id. This prevents infinite nesting — all replies share the same root parent, displayed chronologically.
- **Resolve/unresolve (35.4)**: Resolved comments set `resolved_at` timestamp (never deleted). Resolved threads default to collapsed state but are searchable via the "Resolved" tab. New replies to a resolved thread automatically reopen it.
- **@mention (35.5)**: Comments are plain text. @mentions are just `@username` text. When a comment contains `@username`, the backend processes it: looks up the user, checks if they have access to the node, creates a `mention` type notification.
- **Anchor position (35.2)**: Stored as JSON string `{from, to, text, path}` using ProseMirror's position system. The `text` field provides a fallback for matching when positions shift due to edits above.
- **Realtime sync (35.6)**: Uses a dedicated Socket.IO service on port 3004 (comment-sync-service) alongside the existing collab service on 3003. Frontend connects via `io('/?XTransformPort=3004')`. React Query also refetches every 15 seconds as a fallback.
- **Permissions**: Comment creation requires 'comment' or higher access. Resolve/unresolve requires author, owner, or edit-level access. Delete requires author or node owner. Root comment deletion cascades to all replies.

### Lint Status
- All files pass ESLint checks with zero errors/warnings

### Dev Server Status
- Next.js dev server running on port 3000 (healthy)
- Comment-sync-service running on port 3004 (healthy)
