# Task 3-b: Module 40-41 Frontend UI — Workspace Switcher, Invitation Flow, Member Management, Workspace Settings

## Agent: full-stack-developer

## Work Summary

Implemented the complete Module 40-41 frontend UI for workspace management, including:

### Files Created:

1. **`/src/store/workspace.ts`** — Zustand store for workspace context management
   - Tracks `currentWorkspaceId`, `currentWorkspaceName`, `currentWorkspaceRole`
   - `workspaces` array and `workspaceRoles` map for available workspaces
   - `setCurrentWorkspace()` / `clearWorkspace()` actions
   - `invalidateWorkspaceCaches()` helper function for React Query cache invalidation (40.5 — prevents data-leak from old workspace)

2. **`/src/hooks/use-workspace.ts`** — React Query hooks for workspace data
   - `useWorkspaces()` — GET /api/workspaces + syncs with Zustand store
   - `useWorkspace(id)` — GET /api/workspaces/[id]
   - `useWorkspaceMembers(id)` — GET /api/workspaces/[id]/members
   - `useWorkspaceInvitations()` — Filters notifications for pending invitations
   - `useInvitationDetails(token)` — GET /api/workspaces/invitations/[token]
   - `useCreateWorkspace()` — POST mutation
   - `useInviteMember(workspaceId)` — POST mutation (with seat limit handling)
   - `useUpdateMemberRole(workspaceId)` — PATCH mutation
   - `useRemoveMember(workspaceId)` — DELETE mutation
   - `useTransferOwnership(workspaceId)` — POST mutation (41.5)
   - `useAcceptInvitation()` — POST mutation (switches workspace context after accept)
   - `useDeclineInvitation()` — PATCH mutation
   - `useUpdateWorkspace(workspaceId)` — PATCH mutation (name/planTier)
   - `useDeleteWorkspace()` — DELETE mutation (owner only)

3. **`/src/components/workspace/workspace-switcher.tsx`** — Header dropdown component
   - Shows "Personal" when currentWorkspaceId is null (default)
   - Shows workspace name + icon when in workspace context
   - Dropdown: "Personal Workspace" + list of workspaces with role badges
   - Each workspace item shows name + role badge (owner=gold, admin=blue, member=default, viewer=gray)
   - "Create Workspace" option at bottom of dropdown (opens inline dialog)
   - Uses shadcn/ui DropdownMenu, Dialog components
   - Switching triggers `invalidateWorkspaceCaches()` per 40.5

4. **`/src/components/workspace/workspace-member-list.tsx`** — Member management component
   - Table/list of members: avatar, name, email, role badge, joined date
   - Role badges with colors: owner=gold, admin=blue, member=default, viewer=gray
   - Pending invitations shown with amber "Pending" badge
   - "Change Role" dropdown for admin/owner (3 options: admin, member, viewer)
   - "Remove Member" button — AlertDialog confirmation
   - "Invite Member" button — opens WorkspaceInviteDialog
   - Current user marked as "(you)", cannot remove themselves or change own role
   - Owner's role cannot be changed (41.4)

5. **`/src/components/workspace/workspace-invite-dialog.tsx`** — Invitation dialog
   - Email input field (validated)
   - Role selector dropdown (member/viewer/admin)
   - "Send Invitation" button — POST to /api/workspaces/[id]/members
   - Seat limit info display: "3 of 10 seats used"
   - Error state: "Seat limit reached — upgrade plan to add more members" (41.2)

6. **`/src/components/workspace/workspace-invitation-view.tsx`** — Accept/Decline invitations view
   - Modal/dialog for pending workspace invitations
   - Shows: workspace name, inviter email, role offered, expiry date
   - "Accept" and "Decline" buttons per invitation
   - Detailed view on click: shows inviter details, expiry, role badge
   - After accept → switches to that workspace context via store
   - Fetches invitation details from /api/workspaces/invitations/[token]

7. **`/src/components/workspace/workspace-settings-dialog.tsx`** — Workspace settings dialog
   - Workspace name editing (admin/owner only)
   - Plan tier display with upgrade button (links to billing Module 42)
   - Seat usage display
   - Ownership transfer section (41.5) — select from existing admin members
   - "Delete Workspace" button (owner only, with AlertDialog confirmation)
   - Personal workspace message when no workspace selected

### Files Modified:

8. **`/src/components/workspace/workspace-layout.tsx`** — Updated header
   - Replaced static "Unified Workspace" logo with `<WorkspaceSwitcher />` component
   - Added "Workspace Settings" option in user dropdown (for workspace context, owner/admin only)
   - Added "Invitations" option in user dropdown
   - Added `<WorkspaceSettingsDialog>` and `<WorkspaceInvitationView>` dialog components
   - Imported `useWorkspaceStore` and `useWorkspaces` hook
   - Workspaces are auto-fetched on layout mount

9. **`/src/components/workspace/sidebar.tsx`** — Updated sidebar
   - Added workspace context indicator at top (workspace name + role)
   - Added "Settings" and "Members" quick links when in workspace context
   - Collapsed sidebar: workspace settings icon and members icon
   - Added `<WorkspaceSettingsDialog>` and member list dialog integration
   - Imported `useWorkspaceStore` and workspace-related components

### Key Design Decisions:

- **Zustand store** for workspace context (not just React Query) — allows components to read current workspace without refetching
- **`invalidateWorkspaceCaches()`** is called from React components (not inside Zustand) because `useQueryClient()` is a React hook
- **Role badges** use distinct color coding for visual hierarchy: gold for owner, blue for admin, neutral for member, gray for viewer
- **44px touch targets** maintained throughout (min-h-[44px] min-w-[44px])
- **Responsive design**: workspace switcher shows icon-only on mobile, name on desktop
- **All API calls** use relative paths as required (e.g., `/api/workspaces/...`)

### Lint: All passing ✓
