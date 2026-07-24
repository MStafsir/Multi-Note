'use client';

// ============================================================
// MODUL 42: Billing/Subscription Panel — Workspace Settings
// 42.1 — Current plan tier display, subscription status badge
// 42.3 — Grace period warning banner
// 42.1 — Upgrade plan buttons, Manage billing, Cancel subscription
// Owner-only component
// ============================================================

import { useState, useCallback } from 'react';
import {
  CreditCard,
  Crown,
  Building2,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
  ExternalLink,
  XCircle,
  CheckCircle2,
  Zap,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useWorkspaceSubscription, useCreateSubscription, useCancelSubscription } from '@/hooks/use-billing';
import type { SubscriptionStatus } from '@/types';

// --- Plan tier features mapping ---
const PLAN_FEATURES: Record<string, { icon: React.ReactNode; name: string; price: string; features: string[] }> = {
  free: {
    icon: <Zap className="h-5 w-5" />,
    name: 'Free',
    price: '$0/month',
    features: [
      '1 workspace',
      '100 MB storage',
      'Basic note editing',
      '5 API keys',
      'Community support',
    ],
  },
  pro: {
    icon: <Crown className="h-5 w-5" />,
    name: 'Pro',
    price: '$9/month',
    features: [
      'Unlimited workspaces',
      '10 GB storage',
      'Advanced note editing + math blocks',
      '20 API keys',
      'Webhook integrations',
      'Version history (30 days)',
      'Priority support',
    ],
  },
  enterprise: {
    icon: <Building2 className="h-5 w-5" />,
    name: 'Enterprise',
    price: '$29/month',
    features: [
      'Unlimited workspaces',
      '100 GB storage',
      'All editing features',
      'Unlimited API keys',
      'Unlimited webhooks',
      'Custom branding',
      'SSO / SAML integration',
      'Audit log & compliance',
      'Dedicated support',
    ],
  },
};

// --- Subscription status badge color mapping ---
function getStatusBadge(status: SubscriptionStatus): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string } {
  switch (status) {
    case 'active':
      return { label: 'Active', variant: 'default', className: 'bg-green-600 text-white' };
    case 'trialing':
      return { label: 'Trialing', variant: 'default', className: 'bg-blue-600 text-white' };
    case 'past_due':
      return { label: 'Past Due', variant: 'destructive', className: 'bg-red-600 text-white' };
    case 'grace_period':
      return { label: 'Grace Period', variant: 'destructive', className: 'bg-orange-600 text-white' };
    case 'canceled':
      return { label: 'Canceled', variant: 'secondary', className: 'bg-gray-500 text-white' };
    default:
      return { label: status, variant: 'outline', className: '' };
  }
}

interface WorkspaceBillingPanelProps {
  workspaceId: string;
  currentPlanTier: string;
}

export function WorkspaceBillingPanel({ workspaceId, currentPlanTier }: WorkspaceBillingPanelProps) {
  const { data: subscription, isLoading: subscriptionLoading } = useWorkspaceSubscription(workspaceId);
  const createSubscription = useCreateSubscription(workspaceId);
  const cancelSubscription = useCancelSubscription(workspaceId);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedUpgradeTier, setSelectedUpgradeTier] = useState<'pro' | 'enterprise'>('pro');

  // Grace period end date for warning banner
  const gracePeriodEnd = subscription?.gracePeriodEnd;

  // Handle upgrade subscription
  const handleUpgrade = useCallback(async () => {
    try {
      await createSubscription.mutateAsync({
        provider: 'stripe',
        planTier: selectedUpgradeTier,
      });
      setUpgradeDialogOpen(false);
      toast.success(`Upgraded to ${selectedUpgradeTier} plan!`);
    } catch {
      // Error handled by mutation
    }
  }, [createSubscription, selectedUpgradeTier]);

  // Handle cancel subscription
  const handleCancel = useCallback(async () => {
    try {
      await cancelSubscription.mutateAsync();
      setCancelDialogOpen(false);
    } catch {
      // Error handled by mutation
    }
  }, [cancelSubscription]);

  // Current plan info
  const currentPlan = PLAN_FEATURES[currentPlanTier] || PLAN_FEATURES.free;
  const statusBadge = subscription ? getStatusBadge(subscription.status) : getStatusBadge('active');

  return (
    <div className="space-y-6">
      {/* 42.3 — Grace Period Warning Banner */}
      {subscription?.status === 'past_due' && gracePeriodEnd && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-orange-800 dark:text-orange-300">
              Payment failed — 3-day grace period ends {new Date(gracePeriodEnd).toLocaleDateString()}
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-400">
              Update your payment method to avoid downgrade to the Free plan.
            </p>
          </div>
        </div>
      )}

      {/* 42.1 — Current Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>
            Your workspace is currently on the {currentPlan.name} plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plan tier + status badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
              {currentPlan.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">{currentPlan.name} Plan</span>
                <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{currentPlan.price}</p>
            </div>
          </div>

          {/* Features list */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Included features:</p>
            <ul className="space-y-1">
              {currentPlan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Current period info */}
          {subscription && subscription.currentPeriodEnd && (
            <div className="text-sm text-muted-foreground">
              {subscription.cancelAtPeriodEnd
                ? `Access ends on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                : `Next billing date: ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 42.1 — Upgrade Plan Buttons */}
      {currentPlanTier === 'free' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5" />
              Upgrade Your Plan
            </CardTitle>
            <CardDescription>
              Unlock more features and storage by upgrading to a higher plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pro upgrade */}
              <div className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-amber-600" />
                  <span className="font-semibold">Pro</span>
                  <Badge variant="outline">$9/month</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Unlimited workspaces, 10 GB, webhooks, version history.
                </p>
                <Button
                  className="w-full min-h-[44px]"
                  onClick={() => {
                    setSelectedUpgradeTier('pro');
                    setUpgradeDialogOpen(true);
                  }}
                  disabled={createSubscription.isPending}
                >
                  {createSubscription.isPending && selectedUpgradeTier === 'pro' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Upgrade to Pro
                </Button>
              </div>

              {/* Enterprise upgrade */}
              <div className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-violet-600" />
                  <span className="font-semibold">Enterprise</span>
                  <Badge variant="outline">$29/month</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Unlimited everything, 100 GB, SSO, audit log, dedicated support.
                </p>
                <Button
                  variant="secondary"
                  className="w-full min-h-[44px]"
                  onClick={() => {
                    setSelectedUpgradeTier('enterprise');
                    setUpgradeDialogOpen(true);
                  }}
                  disabled={createSubscription.isPending}
                >
                  {createSubscription.isPending && selectedUpgradeTier === 'enterprise' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Upgrade to Enterprise
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 42.1 — Manage Billing & Cancel Subscription */}
      {(subscription && currentPlanTier !== 'free') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Subscription Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Manage Billing link */}
            <div className="flex items-center gap-4">
              <Button variant="outline" className="min-h-[44px]" asChild>
                <a href="#" onClick={(e) => { e.preventDefault(); toast.info('In production, this opens the Stripe/Midtrans customer portal'); }}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage Billing
                </a>
              </Button>
              <p className="text-sm text-muted-foreground">
                Update payment method, view billing history, download invoices.
              </p>
            </div>

            {/* Cancel subscription */}
            {!subscription.cancelAtPeriodEnd && subscription.status !== 'canceled' && (
              <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="min-h-[44px]">
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Cancel Subscription?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Your workspace will be downgraded to the Free plan at the end of the current billing period
                      ({subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'end of period'}).
                      You will retain access to all Pro/Enterprise features until then.
                      <br /><br />
                      <strong>This action cannot be reversed.</strong> You would need to create a new subscription to upgrade again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={cancelSubscription.isPending} className="min-h-[44px]">
                      Keep Subscription
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      disabled={cancelSubscription.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]"
                    >
                      {cancelSubscription.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Canceling...
                        </>
                      ) : (
                        'Cancel Subscription'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Already canceled notice */}
            {subscription.cancelAtPeriodEnd && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Subscription canceled</p>
                  <p className="text-sm text-muted-foreground">
                    Your workspace will downgrade to Free on {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'the end of the billing period'}.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upgrade confirmation dialog */}
      <AlertDialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Upgrade to {PLAN_FEATURES[selectedUpgradeTier].name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You will be charged {PLAN_FEATURES[selectedUpgradeTier].price} for the {PLAN_FEATURES[selectedUpgradeTier].name} plan.
              This includes:
              <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                {PLAN_FEATURES[selectedUpgradeTier].features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createSubscription.isPending} className="min-h-[44px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUpgrade}
              disabled={createSubscription.isPending}
              className="min-h-[44px]"
            >
              {createSubscription.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Upgrading...
                </>
              ) : (
                `Upgrade to ${PLAN_FEATURES[selectedUpgradeTier].name}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loading overlay */}
      {subscriptionLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
