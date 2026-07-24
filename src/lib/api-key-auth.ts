// ============================================================
// MODUL 43: API Key Authentication Middleware Helper
// Authenticates requests via x-api-key header, checks scope authorization
// ============================================================

import { db } from '@/lib/db';
import crypto from 'crypto';
import type { ApiKeyScope } from '@/types';

// 43.3 — Scope hierarchy: admin > read_write > read_only
const SCOPE_HIERARCHY: Record<ApiKeyScope, number> = {
  read_only: 1,
  read_write: 2,
  admin: 3,
};

interface ApiKeyAuthResult {
  authenticated: boolean;
  userId: string | null;
  workspaceId: string | null;
  scopes: ApiKeyScope[];
  apiKeyId: string | null;
}

/**
 * Authenticate a request via API key (x-api-key header).
 * 1. Hash the provided key with SHA-256.
 * 2. Look up the hash in api_keys table.
 * 3. Check revokedAt is null.
 * 4. Return auth result with userId, workspaceId, scopes.
 */
export async function authenticateApiKey(apiKey: string): Promise<ApiKeyAuthResult> {
  if (!apiKey) {
    return { authenticated: false, userId: null, workspaceId: null, scopes: [], apiKeyId: null };
  }

  // Hash the provided key
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Look up by hash
  const apiKeyRecord = await db.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      ownerId: true,
      workspaceId: true,
      scopes: true,
      revokedAt: true,
    },
  });

  // Not found or revoked
  if (!apiKeyRecord || apiKeyRecord.revokedAt !== null) {
    return { authenticated: false, userId: null, workspaceId: null, scopes: [], apiKeyId: null };
  }

  // Parse scopes from JSON string
  const scopes: ApiKeyScope[] = JSON.parse(apiKeyRecord.scopes) as ApiKeyScope[];

  // Update lastUsedAt (non-blocking — don't await)
  db.apiKey.update({
    where: { id: apiKeyRecord.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {
    // Ignore errors from lastUsedAt update — non-critical
  });

  return {
    authenticated: true,
    userId: apiKeyRecord.ownerId,
    workspaceId: apiKeyRecord.workspaceId,
    scopes,
    apiKeyId: apiKeyRecord.id,
  };
}

/**
 * Check if the provided scopes satisfy the required scope level.
 * 43.3 — Scope hierarchy: admin > read_write > read_only
 */
export function hasScope(scopes: ApiKeyScope[], required: 'read_only' | 'read_write' | 'admin'): boolean {
  const requiredLevel = SCOPE_HIERARCHY[required];
  return scopes.some(scope => SCOPE_HIERARCHY[scope] >= requiredLevel);
}
