# Task 3-a — Module 40-41 Backend APIs

## Agent: full-stack-developer

## Files Created

### API Routes (8 files)
1. `/src/app/api/workspaces/route.ts` — Workspace CRUD (GET list, POST create)
2. `/src/app/api/workspaces/[id]/route.ts` — Workspace detail (GET, PATCH, DELETE)
3. `/src/app/api/workspaces/[id]/members/route.ts` — Members (GET list, POST invite)
4. `/src/app/api/workspaces/[id]/members/[memberId]/route.ts` — Member role (PATCH, DELETE)
5. `/src/app/api/workspaces/invitations/[token]/route.ts` — Invitation accept/decline (GET public, POST accept, PATCH decline)
6. `/src/app/api/workspaces/[id]/transfer/route.ts` — Ownership transfer (POST)

### Lib Files (2 new + 2 updated)
1. `/src/lib/workspace-permissions.ts` — 6 helper functions: getWorkspaceRole, requireWorkspaceRole, checkWorkspaceAccess, checkNodeWorkspaceAccess, isWorkspaceOwner, getUserWorkspaceIds
2. `/src/lib/workspace-quota.ts` — SEAT_LIMITS, WORKSPACE_STORAGE_LIMITS, getCurrentSeatCount, canAddSeat, getWorkspaceStorageLimit, getWorkspaceStorageUsed, canDowngradePlan
3. `/src/lib/permissions.ts` — Updated checkNodeAccess with 40.3 workspace member check (step 2)
4. `/src/lib/db.ts` — Updated PrismaClient singleton pattern for development mode

### Validators
- `/src/lib/validators/index.ts` — Added 7 workspace Zod schemas

### Middleware
- `/src/middleware.ts` — Added workspace route protection + public invitation GET exception

## Key Implementation Details

### 40.1 — Workspace CRUD
- POST creates workspace with plan_tier='free', auto-creates WorkspaceMember with role='owner'
- GET lists all workspaces where user is owner or member, includes role, member count, node count

### 40.2/40.4 — Members & Role-permission matrix
- GET members requires viewer+ role
- POST invite requires owner/admin, checks 41.2 seat limits
- Role hierarchy: owner(4) > admin(3) > member(2) > viewer(1)

### 40.6 — Invitations
- UUID token with 7-day expiry
- GET is public (no auth required)
- POST accept requires authenticated user with matching email
- PATCH decline requires authenticated user with matching email

### 41.1/41.2 — Seat Management
- free: 3 seats, pro: 10 seats, enterprise: 50 seats
- canAddSeat checks current seat count against plan tier limit

### 41.3 — Downgrade Guard
- canDowngradePlan checks: seat count ≤ new tier limit, storage used ≤ new tier limit
- Returns blockers array with specific messages

### 41.4 — Role Audit
- Role changes logged with actionType='edit', metadata {old_role, new_role, targetUserId}
- Cannot change owner's role via PATCH endpoint
- Cannot assign 'owner' role via PATCH (must use transfer endpoint)

### 41.5 — Ownership Transfer
- Only current owner can initiate
- Target must be existing admin member with joinedAt
- After transfer: old owner → 'admin', new owner → 'owner'
- Owner cannot leave workspace without transferring first (returns 403)

### 40.3 — RLS Equivalent
- checkNodeAccess updated with workspace member check
- Union condition: ownerId=userId OR (workspaceId exists AND user is workspace member)
- Role → permission mapping: owner/admin/member = edit, viewer = view

## Verification Results
- Lint: 0 errors, clean
- API endpoints respond correctly
- Invitation GET works as public route
- Workspace POST/PATCH/DELETE properly protected by middleware
