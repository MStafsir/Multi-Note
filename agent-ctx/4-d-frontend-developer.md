---
Task ID: 4-d
Agent: frontend-developer
Task: Build Module 19+20 UI (Activity Log + Notification System)

Work Log:
- Created `/src/hooks/use-activity.ts` — React Query hooks for activity log
  - useActivityLog(nodeId?) — fetch all user activity or filtered by nodeId
  - useNodeActivity(nodeId) — fetch activity for specific node (dedicated endpoint)
  - ACTIVITY_KEYS query key factory for cache invalidation
  - ActivityEntry type matching API response shape

- Created `/src/components/activity/activity-timeline.tsx` — Timeline display component
  - Props: { nodeId?, className? }
  - Each entry shows action icon (create=Plus, rename=Pencil, move=ArrowRight, delete=Trash2, restore=RotateCcw, share=Share2, edit=Pencil)
  - Human-readable descriptions: "John renamed 'old-name' to 'new-name'"
  - Relative timestamps via date-fns formatDistanceToNow
  - Expandable metadata (click to see JSON details)
  - ScrollArea with max-h-64 overflow
  - Empty state: "No activity yet"
  - Load more indicator showing count of total entries
  - Fixed conditional hook call lint error (rules-of-hooks) by always calling both hooks and selecting result

- Created `/src/hooks/use-notifications.ts` — React Query hooks for notifications
  - useNotifications() — fetch notifications + unread count, refetchInterval: 30000 (20.3 real-time polling)
  - useMarkNotificationsRead() — mutation to mark as read (notificationIds or markAll)
  - useNotificationPreferences() — fetch preferences (20.5)
  - useUpdateNotificationPreferences() — mutation to update preferences (20.5)
  - NOTIFICATION_KEYS query key factory
  - NotificationEntry, NotificationPreferences, NotificationChannel types

- Created `/src/components/notifications/notification-badge.tsx` — Header badge component
  - Bell icon with red badge showing unread count (framer-motion animation)
  - Popover opens NotificationDropdown on click
  - Settings gear icon opens NotificationPreferencesDialog
  - Positioned in workspace-layout header (right side, before calculator)

- Created `/src/components/notifications/notification-dropdown.tsx` — Dropdown/popover component
  - Shows list of recent notifications with type icons (share_received=Share2, quota_warning=AlertTriangle, comment_added=MessageSquare, mention=AtSign)
  - Read/unread indicator (bold for unread, muted for read, red dot for unread)
  - "Mark all as read" button at top
  - Click notification → mark as read + close dropdown + navigate to relevant node
  - Empty state: "No notifications"
  - Uses formatDistanceToNow for timestamps

- Created `/src/components/notifications/notification-preferences-dialog.tsx` — Settings dialog
  - Four preference rows: Share received, Comment added, Mention, Quota warning
  - Each row has Select dropdown (In-App / Email / Both / Off)
  - Quota warning defaults to "Both" (critical)
  - Save button → PUT preferences API
  - Edit-tracking approach (edits merged with fetched data) to avoid useEffect setState lint error
  - Reset edits on dialog close

- Updated `/src/components/workspace/sidebar.tsx` — Added Activity section
  - Added Activity icon import from lucide-react
  - Added ActivityTimeline import
  - Added collapsible "Activity" section below Favorites, above Trash
  - Passes currentFolderId to ActivityTimeline for node-specific activity

- Updated `/src/components/workspace/workspace-layout.tsx` — Added NotificationBadge
  - Imported NotificationBadge component
  - Added <NotificationBadge /> in header right section, before calculator button
  - Contains bell icon + popover dropdown + settings gear icon

- Lint passed clean (0 errors, 1 pre-existing warning in version-diff-dialog.tsx)
- Dev server running correctly, page returns 200 OK
- Notification API confirmed working (GET /api/notifications 200, GET /api/notifications/preferences 200)

Stage Summary:
- Module 19 (Activity Log UI): Timeline component with action icons, descriptions, relative timestamps, expandable metadata, integrated into sidebar as collapsible section
- Module 20 (Notification System UI): Badge in header with real-time polling (30s), dropdown with type icons and read/unread states, preferences dialog with channel selection, all integrated into workspace-layout
- All components use 'use client', shadcn/ui, framer-motion, date-fns, React Query
- No lint errors in new code, dev server functional
