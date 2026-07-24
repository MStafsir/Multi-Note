'use client';

// ============================================================
// MODUL 42-44: Unified Workspace Advanced Settings Panel
// Tabbed settings combining Data Portability, Billing, API Keys, Webhooks
// Tabs: "Data" | "Billing" | "API Keys" | "Webhooks"
// Owner-only tabs: Billing (shown only when workspaceId is provided)
// All members can see Data, API Keys (personal), Webhooks (personal)
// ============================================================

import { CreditCard, Key, Webhook, Download, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataPortabilitySettings } from '@/components/settings/data-portability';
import { WorkspaceBillingPanel } from './workspace-billing-panel';
import { WorkspaceInvoiceHistory } from './workspace-invoice-history';
import { ApiKeyManager } from './api-key-manager';
import { WebhookManager } from './webhook-manager';

interface WorkspaceAdvancedSettingsProps {
  /** If provided, shows workspace-level billing. If null, shows personal settings only. */
  workspaceId?: string | null;
  /** Current plan tier for billing display */
  planTier?: string;
}

export function WorkspaceAdvancedSettings({ workspaceId, planTier }: WorkspaceAdvancedSettingsProps) {
  // Only show billing tab if we have a workspace context (owner-only)
  const showBilling = !!workspaceId;
  const currentPlanTier = planTier || 'free';

  return (
    <div className="w-full">
      <Tabs defaultValue="data" className="w-full">
        <TabsList className="w-full flex-wrap mb-4">
          <TabsTrigger value="data" className="flex items-center gap-1.5 min-h-[44px]">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
          {showBilling && (
            <TabsTrigger value="billing" className="flex items-center gap-1.5 min-h-[44px]">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="api-keys" className="flex items-center gap-1.5 min-h-[44px]">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">API Keys</span>
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-1.5 min-h-[44px]">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Webhooks</span>
          </TabsTrigger>
        </TabsList>

        {/* Data Portability tab */}
        <TabsContent value="data">
          <DataPortabilitySettings />
        </TabsContent>

        {/* Billing tab (workspace owner only) */}
        {showBilling && (
          <TabsContent value="billing" className="space-y-6">
            <WorkspaceBillingPanel
              workspaceId={workspaceId!}
              currentPlanTier={currentPlanTier}
            />
            <WorkspaceInvoiceHistory workspaceId={workspaceId!} />
          </TabsContent>
        )}

        {/* API Keys tab */}
        <TabsContent value="api-keys">
          <ApiKeyManager />
        </TabsContent>

        {/* Webhooks tab */}
        <TabsContent value="webhooks">
          <WebhookManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
