// ============================================================
// MODUL 54.7: Public File Access Token System
// Generates temporary access tokens for Google Docs Viewer
// and other external services that need public file URLs.
//
// Tokens are stored in an in-memory Map, expire after 5 minutes,
// and are cleaned up periodically by a background interval.
// ============================================================

interface PublicAccessTokenEntry {
  nodeId: string;
  expiresAt: number;
}

// In-memory token store
const publicAccessTokens = new Map<string, PublicAccessTokenEntry>();

// Clean up expired tokens every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// Use setInterval for token cleanup — runs in Node.js server process
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return; // Already running
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [token, entry] of publicAccessTokens.entries()) {
      if (now > entry.expiresAt) {
        publicAccessTokens.delete(token);
      }
    }
  }, CLEANUP_INTERVAL);
}

// Start cleanup on module load
startCleanup();

/**
 * Generate a temporary public access token for a file node.
 * The token expires after 5 minutes and can be used multiple times
 * within that window (Google Docs Viewer may make multiple HTTP requests).
 */
export function generatePublicAccessToken(nodeId: string): string {
  const token = crypto.randomUUID();
  publicAccessTokens.set(token, {
    nodeId,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
  return token;
}

/**
 * Validate a public access token for a specific node.
 * If valid, returns true (token remains valid for the 5-minute window).
 * If invalid (wrong node, expired, or not found), returns false and cleans up.
 *
 * Note: Token is NOT one-time-use because Google Docs Viewer may make
 * multiple HTTP requests (HEAD + GET, or range requests) to the same URL.
 * The token remains valid until the 5-minute expiry, then is cleaned up
 * by the periodic cleanup interval.
 */
export function validatePublicAccessToken(token: string, nodeId: string): boolean {
  const entry = publicAccessTokens.get(token);
  if (!entry) return false;
  if (entry.nodeId !== nodeId) return false;
  if (Date.now() > entry.expiresAt) {
    publicAccessTokens.delete(token);
    return false;
  }
  // Token remains valid for the 5-minute window (not one-time-use)
  return true;
}
