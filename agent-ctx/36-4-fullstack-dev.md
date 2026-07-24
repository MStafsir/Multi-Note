# Task 36-4: Admin Dashboard UI Component

## Summary
Created the Admin Dashboard UI for the Unified Workspace project, integrating it into the existing workspace layout with sidebar navigation and view switching.

## Files Modified
1. **`src/store/file-tree.ts`** — Extended `activeView` type to include `'admin'` alongside `'workspace'` and `'trash'`
2. **`src/components/admin/admin-dashboard.tsx`** — New comprehensive admin dashboard component (~500 lines)
3. **`src/components/workspace/sidebar.tsx`** — Added Shield icon and admin button (visible only for `user.role === 'admin'`)
4. **`src/components/workspace/workspace-layout.tsx`** — Added AdminDashboard import and view rendering for `activeView === 'admin'`

## Dashboard Features
- 6 overview metric cards (DAU, MAU, Total Users, Total Nodes, Storage, Error Rate)
- Latency summary bar (p50, avg, p99 + request count)
- DAU/MAU time-series AreaChart with 7d/30d/90d range selector
- Storage trend BarChart
- Uploads & Notes BarChart
- CSV export buttons (metrics, users, activity)
- Snapshot refresh button with success feedback
- User management table with drill-down expansion
- Activity logs viewer with level/action filters
- Responsive mobile-friendly design
- Loading/error states

## Data Sources
All data fetched via existing admin API endpoints:
- GET `/api/admin/metrics?range=7d|30d|90d`
- GET `/api/admin/users` (list) / GET `/api/admin/users?user_id=xxx` (drilldown)
- GET `/api/admin/logs?level=...&action=...&limit=50`
- POST `/api/admin/snapshot`
- GET `/api/admin/export?type=metrics|users|activity&format=csv`

## Lint Status
✅ Clean (0 errors)
