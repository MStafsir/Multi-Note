// ============================================================
// Socket.IO Connection Configuration
// Auto-detects environment and provides the correct connection URL.
//
// - Z.ai Sandbox: Uses Caddy gateway with XTransformPort query param
// - Other environments (Antigravity, local dev, etc.): Direct connection
// ============================================================

/**
 * Detects if we're running inside the Z.ai sandbox environment.
 * Z.ai sandbox uses Caddy gateway that requires XTransformPort query param.
 */
function isZaiSandbox(): boolean {
  if (typeof window === 'undefined') return false;

  // Z.ai sandbox typically has a specific hostname pattern or we can check
  // for the Caddy gateway. We detect by checking if the hostname contains
  // the Z.ai preview domain pattern.
  const hostname = window.location.hostname;

  // Z.ai preview URLs typically use patterns like:
  // - preview-chat-*.space-z.ai
  // - *.space-z.ai
  // - localhost with Caddy on port 81
  if (hostname.includes('space-z.ai')) return true;

  // Also check if we're in a sandbox by checking for the XTransformPort
  // support — we can detect by checking if the Caddy gateway is responding
  // on port 81 (Z.ai sandbox internal)
  // For now, we'll also allow a runtime check via env variable
  return false;
}

/**
 * Service ports for Socket.IO mini-services
 */
export const SERVICE_PORTS = {
  collab: 3003,
  commentSync: 3004,
} as const;

export type ServiceName = keyof typeof SERVICE_PORTS;

/**
 * Get the Socket.IO connection path for a given service.
 *
 * In Z.ai sandbox: returns "/?XTransformPort={port}" (Caddy gateway routing)
 * In other environments: returns the current origin (same-host proxy assumed)
 *
 * For non-Z.ai environments, you need to set up a reverse proxy (nginx, etc.)
 * that forwards:
 *   /socket.io/?service=collab     → localhost:3003
 *   /socket.io/?service=comment    → localhost:3004
 *
 * OR set the NEXT_PUBLIC_SOCKET_URLS env variable:
 *   NEXT_PUBLIC_SOCKET_URLS=http://localhost:3003,http://localhost:3004
 */
export function getSocketPath(service: ServiceName): string {
  const port = SERVICE_PORTS[service];

  // Check for explicit env override first
  if (typeof window !== 'undefined') {
    const envUrls = (window as unknown as Record<string, string>).__NEXT_DATA__?.runtimeConfig?.socketUrls;
    if (envUrls) {
      const urls = envUrls.split(',');
      const index = service === 'collab' ? 0 : 1;
      if (urls[index]) return urls[index];
    }
  }

  // Z.ai sandbox: use Caddy gateway with XTransformPort
  if (isZaiSandbox()) {
    return `/?XTransformPort=${port}`;
  }

  // Default: try direct connection to the service port on the same host
  // This works when the environment has a reverse proxy or direct port access
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${port}`;
  }

  return `/?XTransformPort=${port}`;
}

/**
 * Get Socket.IO client options for a given service.
 * Handles transport configuration for both environments.
 */
export function getSocketOptions(service: ServiceName) {
  const port = SERVICE_PORTS[service];

  // Check for explicit env override
  if (typeof window !== 'undefined') {
    const envUrls = (window as unknown as Record<string, string>).__NEXT_DATA__?.runtimeConfig?.socketUrls;
    if (envUrls) {
      return {
        transports: ['websocket', 'polling'] as const,
        forceNew: false,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      };
    }
  }

  // Z.ai sandbox: use Caddy gateway path
  if (isZaiSandbox()) {
    return {
      path: '/',
      transports: ['websocket', 'polling'] as const,
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    };
  }

  // Other environments: direct connection
  return {
    transports: ['websocket', 'polling'] as const,
    forceNew: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  };
}
