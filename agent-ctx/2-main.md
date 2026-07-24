# Task 2 - Module 12: Global Search & Indexing

## Summary

Implemented Module 12 (Global Search & Indexing) for the Next.js 16 project, adapting all PostgreSQL-specific features to SQLite.

## Files Created

1. **`/src/app/api/search/route.ts`** — GET API endpoint for search
   - Auth-protected (getServerSession)
   - LIKE-based search on Node.name (SQLite compatible)
   - Note content search: extracts plain text from Tiptap JSON recursively, then LIKE match
   - Type filter (file/folder/note), date range filter (dateFrom/dateTo)
   - Snippet extraction around matched text
   - Combines name matches (higher relevance) + content matches, deduplicates

2. **`/src/hooks/use-search.ts`** — React Query hook with 300ms debounce
   - `useSearch(query, filters)` — debounces query 300ms before fetching
   - `SearchResult` and `SearchFilters` types exported
   - Stale time 30s, enabled only when query has content

3. **`/src/components/search/search-dropdown.tsx`** — SearchDropdown component
   - Debounced input via useSearch hook
   - Realtime dropdown with results as user types
   - Scope filter buttons: All, Files, Folders, Notes (Badge components)
   - Keyboard navigation: arrow keys, Enter, Escape
   - Click outside closes dropdown
   - Clear button to reset
   - Derived `isOpen` state from query length

## Files Modified

4. **`/src/lib/validators/index.ts`** — Added dateFrom/dateTo to searchSchema

5. **`/src/middleware.ts`** — Added `/api/search/:path*` to protected route matcher

6. **`/src/components/workspace/content-area.tsx`** — Replaced simple search Input with SearchDropdown, removed unused imports (Search, Input, searchQuery state)

7. **`/src/components/workspace/workspace-layout.tsx`** — Added Search button in header with ⌘⇧F hint, global keyboard shortcut Ctrl+Shift+F, mobile search button

## Lint Status

- All new code passes lint checks
- Pre-existing errors in calculator-widget.tsx and share-dialog.tsx (not from this module)
- Dev server compiles successfully

## SQLite Adaptations

- No tsvector, GIN indexes, or PostgreSQL-specific features used
- LIKE-based search on Node.name (`contains` in Prisma translates to `LIKE '%query%'`)
- Tiptap JSON content extraction done in-memory (recursive tree walk collecting text nodes)
- SQLite LIKE is case-insensitive for ASCII by default
