---
Task ID: 4-6-a
Agent: full-stack-developer
Task: Module 42-44 Backend APIs — Billing, API Keys, Webhooks

Work Log:
- Read worklog.md to understand previous agents' work (full project context)
- Read prisma schema, existing API routes, lib files, types, validators, middleware to understand patterns
- Created /src/lib/api-key-auth.ts — API Key authentication middleware helper with authenticateApiKey() and hasScope() functions
- Created /src/lib/webhook-dispatch.ts — Webhook dispatch engine with dispatchWebhooks(), signPayload(), processPendingDeliveries() (exponential backoff, max 5 retries, dead_letter + notification)
- Created /src/app/api/workspaces/[id]/subscription/route.ts — GET (owner/admin) and POST (owner) subscription endpoints with Zod validation
- Created /src/app/api/workspaces/[id]/subscription/webhook/route.ts — PUBLIC billing webhook handler (no auth) with idempotency key check, handles invoice.paid, invoice.payment_failed, subscription.deleted
- Created /src/app/api/workspaces/[id]/invoices/route.ts — GET invoices list (owner-only, sorted desc with subscription info)
- Created /src/app/api/api-keys/route.ts — GET list and POST create (uw_ prefix, SHA-256 hash storage, plaintext shown once)
- Created /src/app/api/api-keys/[id]/route.ts — PATCH update scopes and DELETE revoke (immediate invalidation via revokedAt)
- Created /src/app/api/v1/nodes/route.ts — GET list nodes (API key auth, scope >= read_only, pagination, workspace/personal filtering)
- Created /src/app/api/v1/nodes/[id]/route.ts — GET single node detail (API key auth, access verification)
- Created /src/app/api/v1/upload/route.ts — POST upload file (API key auth, scope >= read_write, reuses upload flow with quota checks)
- Created /src/app/api/v1/notes/route.ts — GET list notes and POST create note (API key auth, webhook dispatch on creation)
- Created /src/app/api/v1/notes/[id]/route.ts — GET read content and PATCH update content (API key auth, revision snapshots on update)
- Created /src/app/api/webhooks/route.ts — GET list and POST create webhook subscriptions (HMAC secret generated, masked in list view)
- Created /src/app/api/webhooks/[id]/route.ts — GET detail, PATCH update, DELETE webhook subscriptions
- Created /src/app/api/webhooks/[id]/deliveries/route.ts — GET delivery audit trail with pagination and status filter
- Created /src/app/api/webhooks/process-deliveries/route.ts — POST cron endpoint to process pending/failed deliveries
- Updated /src/middleware.ts — Added routes for api-keys (session auth), v1 (pass-through, auth handled in route), webhooks (session auth), billing webhook (public)
- Updated /src/lib/validators/index.ts — Added Zod schemas for Module 42 (billing), Module 43 (API keys), Module 44 (webhooks)
- Ran lint check — all passing cleanly (no errors)

Stage Summary:
- All 16 files specified in the task have been created
- Middleware updated with proper auth handling for all new routes (session auth for api-keys/webhooks/workspaces, API key auth for v1, public for billing webhook)
- Zod validators added for all Module 42-44 schemas
- Consistent { success: true/false, data/error } response format throughout
- Uses db from @/lib/db, logActivity from @/lib/activity-logger, createNotification from @/lib/notification-sender, logger from @/lib/logger
- API key hashing uses SHA-256, HMAC signing uses SHA-256, key prefix uw_
- BigInt serialization handled via bigintToNumber helper
- Lint passes cleanly
