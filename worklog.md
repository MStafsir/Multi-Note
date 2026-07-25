---
Task ID: 1
Agent: Main Agent
Task: Fix 502 Bad Gateway and make all CRUD operations functional

Work Log:
- Identified that background processes started from Bash tool get killed between commands
- Used `setsid` double-fork daemon technique to start production server that persists across Bash sessions
- Server process (`next-server v16.1.3`) now runs as independent session group (PID 15283)
- Created watchdog-daemon.sh to monitor and restart server if it dies
- Fixed critical bug in ErrorBoundary: `getDerivedStateFromError` was setting `hasError: false` instead of `true`, causing infinite React update loop (error #185)
- Fixed IDB (IndexedDB) schema error: boolean keys are not valid in IndexedDB, changed `synced` field from boolean to number (0/1) with DB version migration
- Fixed ProseMirror schema error: MathBlockNode had `group: 'block inline'` which caused "Mixing inline and block content" error; changed to `group: 'block'`
- Added error logging to ErrorBoundary's componentDidCatch for debugging
- Added try-catch around IDB sync operations in note-editor.tsx to prevent IDB errors from crashing component
- Cleaned up old/unused shell scripts and fixed lint errors
- Rebuilt production build multiple times to test fixes
- Verified all CRUD operations work via agent-browser:
  - Login/Register ✅
  - Create folder ✅
  - Create note ✅
  - Edit note (TiptapEditor with toolbar) ✅
  - Rename note/folder ✅
  - Delete note/folder ✅
  - Restore from trash ✅
  - Calculator (Basic/Scientific/Unit tabs) ✅
  - Search workspace ✅
  - List/Grid view toggle ✅
  - Breadcrumb navigation ✅
  - More actions menu (Favorites, Rename, Share, Delete) ✅

Stage Summary:
- Server running and stable (production mode, port 3000)
- All 3 key bugs fixed: ErrorBoundary infinite loop, IDB boolean keys, ProseMirror mixed content
- All CRUD operations verified working in browser
- Production build clean, lint passes
