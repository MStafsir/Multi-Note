// ============================================================
// Unit Tests — Quota utility
// Tests: tier determination, byte formatting, tier info retrieval
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  QUOTA_TIERS,
  DEFAULT_TIER,
  getTierFromLimit,
  getTierInfo,
  formatQuotaBytes,
} from '@/lib/quota';

describe('QUOTA_TIERS', () => {
  it('defines three tiers: free, pro, enterprise', () => {
    expect(Object.keys(QUOTA_TIERS)).toEqual(['free', 'pro', 'enterprise']);
  });

  it('free tier has 5GB limit', () => {
    expect(QUOTA_TIERS.free.limitBytes).toBe(5 * 1024 * 1024 * 1024);
    expect(QUOTA_TIERS.free.label).toBe('5 GB');
    expect(QUOTA_TIERS.free.name).toBe('Free');
  });

  it('pro tier has 50GB limit', () => {
    expect(QUOTA_TIERS.pro.limitBytes).toBe(50 * 1024 * 1024 * 1024);
    expect(QUOTA_TIERS.pro.label).toBe('50 GB');
  });

  it('enterprise tier has 500GB limit', () => {
    expect(QUOTA_TIERS.enterprise.limitBytes).toBe(500 * 1024 * 1024 * 1024);
  });
});

describe('getTierFromLimit', () => {
  it('returns "free" for 5GB limit', () => {
    expect(getTierFromLimit(5 * 1024 * 1024 * 1024)).toBe('free');
  });

  it('returns "pro" for 50GB limit', () => {
    expect(getTierFromLimit(50 * 1024 * 1024 * 1024)).toBe('pro');
  });

  it('returns "enterprise" for 500GB limit', () => {
    expect(getTierFromLimit(500 * 1024 * 1024 * 1024)).toBe('enterprise');
  });

  it('returns "free" as default for unknown limit', () => {
    expect(getTierFromLimit(999)).toBe('free');
  });
});

describe('getTierInfo', () => {
  it('returns correct tier info for "free"', () => {
    const info = getTierInfo('free');
    expect(info.name).toBe('Free');
    expect(info.limitBytes).toBe(5 * 1024 * 1024 * 1024);
  });

  it('returns correct tier info for "pro"', () => {
    const info = getTierInfo('pro');
    expect(info.name).toBe('Pro');
  });

  it('returns correct tier info for "enterprise"', () => {
    const info = getTierInfo('enterprise');
    expect(info.name).toBe('Enterprise');
  });
});

describe('formatQuotaBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatQuotaBytes(0)).toBe('0 B');
  });

  it('formats bytes under 1KB', () => {
    expect(formatQuotaBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatQuotaBytes(1024)).toBe('1 KB');
    expect(formatQuotaBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatQuotaBytes(1024 * 1024)).toBe('1 MB');
    expect(formatQuotaBytes(5 * 1024 * 1024)).toBe('5 MB');
  });

  it('formats gigabytes', () => {
    expect(formatQuotaBytes(5 * 1024 * 1024 * 1024)).toBe('5 GB');
    expect(formatQuotaBytes(50 * 1024 * 1024 * 1024)).toBe('50 GB');
  });

  it('formats terabytes', () => {
    expect(formatQuotaBytes(500 * 1024 * 1024 * 1024)).toBe('500 GB');
    expect(formatQuotaBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
  });

  it('handles negative bytes', () => {
    expect(formatQuotaBytes(-1)).toBe('0 B');
  });
});
