# Task 4-b: Module 17 — Trash & Restore UI (Frontend)

## Summary
Built the complete frontend UI for the Trash & Restore system (Module 17), integrating it into the existing workspace layout.

## Files Created
- `/src/hooks/use-trash.ts` — React Query hooks (useTrashList, useTrashRestore, useTrashPurge) with TrashedNode type export
- `/src/components/trash/trash-view.tsx` — Full trash page with list view, restore buttons, empty state, loading/error states
- `/src/components/trash/empty-trash-dialog.tsx` — Two-step confirmation modal (checkbox + text input) for emptying trash

## Files Modified
- `/src/store/file-tree.ts` — Added `activeView: 'workspace' | 'trash'` state and `setActiveView` action; `setCurrentFolder` now auto-switches to 'workspace'
- `/src/components/workspace/sidebar.tsx` — Added Trash section (Trash2 icon) below Favorites, active state highlighting, collapsed mode support
- `/src/components/workspace/workspace-layout.tsx` — Conditional rendering: TrashView when activeView='trash', ContentArea when 'workspace'

## Architecture
- View state managed via Zustand (useFileTreeStore.activeView)
- React Query cache keys: ['trash'], ['nodes'], ['storage-quota'] — all invalidated on mutations
- Quota exceeded error (403) handled specifically in useTrashRestore with dedicated toast message
- Two-step purge confirmation uses onOpenChange wrapper for state reset (no useEffect setState to avoid lint error)

## Lint Status
Clean for all new/modified files. Pre-existing errors in activity-timeline.tsx and notification-preferences-dialog.tsx remain (not part of this task).
