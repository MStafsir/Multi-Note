# Task 3-c: Build Module 19+20 API routes (Activity Log + Notifications)

## Agent: full-stack-developer

## Work Summary

### Module 19: Activity Log API

**New files created:**
- `/src/app/api/activity/route.ts` — GET endpoint for activity log entries
  - Query params: `nodeId` (optional), `limit` (default 50, max 200), `offset`
  - If nodeId provided: get ActivityLog entries for that node (19.3 — timeline per file/folder)
  - If no nodeId: get all activity for current user (actorId = userId)
  - Sort by createdAt DESC, includes actor name (User table lookup), parses metadata JSON
  - Returns: `{ success: true, data: { entries: [...], total: N } }`

- `/src/app/api/activity/[nodeId]/route.ts` — GET activity for specific node (dedicated endpoint)
  - Permission check via `checkNodeAccess(userId, nodeId, 'view')`
  - Same enrichment as main activity endpoint (actor names, metadata parsing)
  - Useful for "Activity" tab in file/folder detail view

**Updated files:**
- `/src/app/api/nodes/route.ts` POST — replaced local `logActivity()` with shared `logActivity()` from `@/lib/activity-logger`, removed local helper
- `/src/app/api/nodes/[id]/route.ts` PATCH+DELETE — replaced local `logActivity()` calls with shared `logActivity()` for rename/move/edit/delete
- `/src/app/api/shares/route.ts` POST — replaced direct `db.activityLog.create()` with shared `logActivity()`

### Module 20: Notification System API

**New files created:**
- `/src/app/api/notifications/route.ts` — GET + POST
  - GET: Get notifications for current user, sorted by createdAt DESC, limit 50, includes unread count, parses payload JSON
  - POST: Mark as read with `notificationIds[]` or `markAll=true`, Zod validated, only marks user's own notifications

- `/src/app/api/notifications/preferences/route.ts` — GET + PUT
  - GET: Fetch preferences (auto-creates default row if none exists), returns `{ shareReceived, commentAdded, mention, quotaWarning }`
  - PUT: Upsert preferences with Zod validation, values: "in_app" | "email" | "both" | "off"

**Updated files:**
- `/src/app/api/shares/route.ts` POST — added `createNotification()` for `share_received` type when sharing with a user
- `/src/app/api/storage-quota/route.ts` GET — added `createNotification()` for `quota_warning` when usage >= 90%
- `/src/middleware.ts` — added `/api/activity` and `/api/notifications` route protection

### Lint & Build Status
- Lint: Passed with no errors
- Dev server: Running correctly on port 3000
