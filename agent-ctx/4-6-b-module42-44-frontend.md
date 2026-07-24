# Task 4-6-b: Module 42-44 Frontend UI — Subscription/Billing, API Key Management, Webhook Management

## Summary
Implemented complete frontend UI for Modules 42 (Billing/Subscription), 43 (API Key Management), and 44 (Webhook Management) with unified settings panel integration.

## Files Created
### Hooks (React Query)
- `src/hooks/use-billing.ts` — 4 hooks: useWorkspaceSubscription, useWorkspaceInvoices, useCreateSubscription, useCancelSubscription
- `src/hooks/use-api-keys.ts` — 4 hooks: useApiKeys, useCreateApiKey, useRevokeApiKey, useUpdateApiKeyScopes
- `src/hooks/use-webhooks.ts` — 5 hooks: useWebhookSubscriptions, useCreateWebhook, useUpdateWebhook, useDeleteWebhook, useWebhookDeliveries

### UI Components
- `src/components/workspace/workspace-billing-panel.tsx` — Plan display, status badges, grace period warning, upgrade buttons, cancel dialog
- `src/components/workspace/workspace-invoice-history.tsx` — Invoice table with status badges, pagination, PDF download
- `src/components/workspace/api-key-manager.tsx` — Key list, create dialog, plaintext key display (shown once), revoke/update scopes dialogs
- `src/components/workspace/webhook-manager.tsx` — Webhook list, create dialog, secret display (shown once), active toggle, delete confirmation
- `src/components/workspace/webhook-delivery-dialog.tsx` — Delivery audit trail table, status filter, retry info, pagination
- `src/components/workspace/workspace-advanced-settings.tsx` — Tabbed settings: Data | Billing | API Keys | Webhooks

### Updated Files
- `src/components/workspace/workspace-layout.tsx` — Settings dialog now uses WorkspaceAdvancedSettings with tabs; added `workspaces` to workspace store usage

## Design Decisions
- All mutations invalidate relevant React Query caches on success
- Copy-to-clipboard via navigator.clipboard.writeText() with sonner toast feedback
- "Shown once" secrets/keys with AlertTriangle warning
- Touch targets min-h-[44px] throughout
- Billing tab only shown when workspaceId provided (owner-only context)
- Status badges with consistent color mapping (green/yellow/red/gray)
- Responsive: icon-only tabs on mobile, icon+label on larger screens

## Quality
- Lint: All passing
- TypeScript: No errors in new/modified files
- Dev server: Running and responding (HTTP 200)
