// ============================================================
// MODUL 6.3: Storage Quota Tier Configuration
// Defines quota limits per tier with labels and defaults
// ============================================================

export type QuotaTierKey = 'free' | 'pro' | 'enterprise';

export interface QuotaTier {
  limitBytes: number;
  label: string;
  name: string;
}

export const QUOTA_TIERS: Record<QuotaTierKey, QuotaTier> = {
  free: {
    limitBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    label: '5 GB',
    name: 'Free',
  },
  pro: {
    limitBytes: 50 * 1024 * 1024 * 1024, // 50 GB
    label: '50 GB',
    name: 'Pro',
  },
  enterprise: {
    limitBytes: 500 * 1024 * 1024 * 1024, // 500 GB
    label: '500 GB',
    name: 'Enterprise',
  },
};

export const DEFAULT_TIER: QuotaTierKey = 'free';

/**
 * Determine the quota tier based on the quotaLimitBytes value.
 * Returns the tier key that matches the limit, or 'free' as fallback.
 */
export function getTierFromLimit(limitBytes: number): QuotaTierKey {
  for (const [key, tier] of Object.entries(QUOTA_TIERS)) {
    if (tier.limitBytes === limitBytes) {
      return key as QuotaTierKey;
    }
  }
  return DEFAULT_TIER;
}

/**
 * Get the tier info for a given tier key.
 */
export function getTierInfo(tierKey: QuotaTierKey): QuotaTier {
  return QUOTA_TIERS[tierKey];
}

/**
 * Format bytes into a human-readable string.
 */
export function formatQuotaBytes(bytes: number): string {
  if (bytes < 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
