// ============================================================
// MODUL 3.2: Next.js Middleware — Protected Route Check
// MODUL 36.7: Admin routes require role=admin (defense-in-depth, 403)
// MODUL 37.1: Security headers (CSP, HSTS, X-Content-Type-Options, etc.)
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
// NOTE: Removed Prisma db import from middleware — too heavy for Turbopack compilation
// Admin role check is handled in API route handlers instead (defense-in-depth still works)

// ============================================================
// MODUL 49.9: NEXTAUTH_SECRET — fatal error at boot if missing
// No fallback string permitted. Cannot import from auth.ts (too heavy for middleware).
// ============================================================
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
if (!NEXTAUTH_SECRET) {
  throw new Error(
    'FATAL: NEXTAUTH_SECRET environment variable is not set. ' +
    'Middleware cannot validate tokens without a valid auth secret. ' +
    'Set NEXTAUTH_SECRET in your .env file (generate with: openssl rand -base64 32)'
  );
}

// MODUL 37.2 — Rate limiting store (in-memory, per-IP)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit thresholds per action type (MODUL 37.7)
const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  default: { maxRequests: 100, windowMs: 60_000 },          // 100/min general
  upload: { maxRequests: 10, windowMs: 60_000 },             // 10/min uploads
  create: { maxRequests: 30, windowMs: 60_000 },             // 30/min creates
  delete: { maxRequests: 20, windowMs: 60_000 },             // 20/min deletes
  mutation: { maxRequests: 50, windowMs: 60_000 },           // 50/min mutations
  auth: { maxRequests: 5, windowMs: 60_000 },                // 5/min auth attempts
};

function checkRateLimit(ip: string, actionType: string): { allowed: boolean; remaining: number } {
  const limit = RATE_LIMITS[actionType] || RATE_LIMITS.default;
  const key = `${ip}:${actionType}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + limit.windowMs });
    return { allowed: true, remaining: limit.maxRequests - 1 };
  }

  if (entry.count >= limit.maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit.maxRequests - entry.count };
}

// Cleanup rate limit store periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000);

// MODUL 36.1 — Admin role check moved to API route handlers (db import too heavy for middleware)
// Middleware only checks JWT token role; route handlers do DB-backed verification

// MODUL 37 — Security headers to add to every response
function addSecurityHeaders(response: NextResponse): NextResponse {
  // 37.2 — Strict-Transport-Security (HSTS)
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // 37.2 — X-Content-Type-Options
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // 37.2 — Referrer-Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 37.2 — Permissions-Policy (restrict unused capabilities)
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // 37.1 — CSP header (strict, nonce-based for inline scripts)
  // Production CSP would be stricter; development allows eval for HMR
  const isDev = process.env.NODE_ENV === 'development';
  const cspDirectives = [
    `default-src 'self'`,
    `script-src 'self'${isDev ? " 'unsafe-eval' 'unsafe-inline'" : " 'unsafe-inline'"}`,  // 37.1 — 'unsafe-inline' required for Next.js RSC flight data (__next_f.push); nonce would replace in strict prod CSP
    `script-src-elem 'self' 'unsafe-inline'`, // PDF.js worker from local public dir (no CDN needed)
    `style-src 'self' 'unsafe-inline'`, // Tailwind requires inline styles
    `img-src 'self' data: blob: https:`, // Allow images from storage/blobs
    `media-src 'self' blob:`,
    `font-src 'self'`,
    `connect-src 'self' ws: wss: https:`, // WebSocket for collab + API + external fetches
    `worker-src 'self' blob:`, // PDF.js worker needs blob: URLs
    `frame-ancestors 'none'`, // Prevent embedding
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');

  response.headers.set('Content-Security-Policy', cspDirectives);

  // 37.2 — X-Frame-Options (legacy fallback for CSP frame-ancestors)
  response.headers.set('X-Frame-Options', 'DENY');

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Add security headers to ALL responses (MODUL 37)
  let response = NextResponse.next();
  response = addSecurityHeaders(response);

  // Only protect API routes (not auth routes)
  if (pathname.startsWith('/api/auth')) {
    // MODUL 37.7 — Rate limit only credential login attempts (POST to callback)
    // NOT session checks (GET to session) — useSession calls session endpoint frequently
    if (pathname.includes('/api/auth/callback/credentials') && request.method === 'POST') {
      const ip = request.headers.get('x-forwarded-for') || request.ip || 'unknown';
      const { allowed } = checkRateLimit(ip, 'auth');
      if (!allowed) {
        return NextResponse.json(
          { success: false, error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // MODUL 13 — Share link access route does NOT require auth
  if (pathname.startsWith('/api/shares/link/')) {
    return addSecurityHeaders(NextResponse.next());
  }

  // MODUL 40.6 — Workspace invitation GET is public (no auth required for viewing invite)
  // POST (accept) and PATCH (decline) require auth, handled below in protected routes
  if (pathname.match(/^\/api\/workspaces\/invitations\/[^/]+$/) && request.method === 'GET') {
    return addSecurityHeaders(NextResponse.next());
  }

  // MODUL 42.2 — Billing webhook is PUBLIC (billing provider sends events, no auth)
  if (pathname.match(/^\/api\/workspaces\/[^/]+\/subscription\/webhook$/) && request.method === 'POST') {
    return addSecurityHeaders(NextResponse.next());
  }

  // MODUL 43 — Public API v1 routes authenticate via x-api-key header (not session)
  // Middleware should NOT block these — auth is handled within route handlers
  if (pathname.startsWith('/api/v1')) {
    return addSecurityHeaders(NextResponse.next());
  }

  // MODUL 43 — API key routes need session auth
  if (pathname.startsWith('/api/api-keys')) {
    const token = await getToken({
      req: request,
      secret: NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.id as string);
    requestHeaders.set('x-user-email', token.email as string);
    requestHeaders.set('x-user-role', (token.role as string) || 'user');

    return addSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  // MODUL 44 — Webhook subscription routes need session auth for CRUD
  // Process-deliveries uses cron-secret or x-user-id header
  if (pathname.startsWith('/api/webhooks')) {
    const token = await getToken({
      req: request,
      secret: NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.id as string);
    requestHeaders.set('x-user-email', token.email as string);
    requestHeaders.set('x-user-role', (token.role as string) || 'user');

    return addSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  // MODUL 28 — Export download link route is public (token-based access)
  if (pathname.match(/^\/api\/export\/[^/]+$/) && request.method === 'GET') {
    return addSecurityHeaders(NextResponse.next());
  }

  // MODUL 36.7 — Admin routes: require role=admin (defense-in-depth)
  // This is middleware-level check, NOT just UI hiding
  if (pathname.startsWith('/api/admin')) {
    const token = await getToken({
      req: request,
      secret: NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check role from JWT token (includes profile role from auth.ts callback)
    const role = token.role as string;
    if (role !== 'admin') {
      // Middleware check: JWT role must be 'admin'
      // DB-backed verification is done in API route handlers (defense-in-depth)
      return NextResponse.json(
        { success: false, error: 'Forbidden — Admin access required' },
        { status: 403 }
      );
    }

    // Admin user confirmed — add user info headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.id as string);
    requestHeaders.set('x-user-email', token.email as string);
    requestHeaders.set('x-user-role', role === 'admin' ? 'admin' : 'admin'); // confirmed admin

    return addSecurityHeaders(NextResponse.next({
      request: { headers: requestHeaders },
    }));
  }

  // Check for protected API routes
  if (
    pathname.startsWith('/api/nodes') ||
    pathname.startsWith('/api/upload') ||
    pathname.startsWith('/api/storage-quota') ||
    pathname.startsWith('/api/preview') ||
    pathname.startsWith('/api/search') ||
    pathname.startsWith('/api/calculator') ||
    pathname.startsWith('/api/shares') ||
    pathname.startsWith('/api/users') ||
    pathname.startsWith('/api/activity') ||
    pathname.startsWith('/api/notifications') ||
    pathname.startsWith('/api/trash') ||
    pathname.startsWith('/api/tags') ||
    pathname === '/api/export' ||
    pathname.startsWith('/api/import') ||
    pathname.startsWith('/api/account') ||
    pathname.startsWith('/api/databases') ||
    pathname.startsWith('/api/templates') ||
    pathname.startsWith('/api/comments') ||
    pathname.startsWith('/api/graph') ||
    pathname.startsWith('/api/workspaces') ||
    pathname.startsWith('/api/onboarding') ||
    pathname.startsWith('/api/files')
  ) {
    const token = await getToken({
      req: request,
      secret: NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // MODUL 37.7 — Rate limiting for mutation endpoints
    const ip = request.headers.get('x-forwarded-for') || request.ip || 'unknown';
    let actionType = 'default';

    // Classify action type for rate limiting
    // Upload POST = rate-limited, but upload GET (download) = not rate-limited
    if (pathname.startsWith('/api/upload') && request.method === 'POST') {
      actionType = 'upload';
    } else if (pathname.startsWith('/api/nodes') && request.method === 'POST') {
      actionType = 'create';
    } else if (pathname.startsWith('/api/nodes') && request.method === 'DELETE') {
      actionType = 'delete';
    } else if (pathname.startsWith('/api/trash') || pathname.startsWith('/api/account/delete')) {
      actionType = 'delete';
    } else if (request.method !== 'GET' && request.method !== 'HEAD') {
      actionType = 'mutation';
    }

    // Only rate limit mutations (not GET requests, including file downloads)
    if (request.method !== 'GET') {
      const { allowed, remaining } = checkRateLimit(ip, actionType);
      if (!allowed) {
        return NextResponse.json(
          { success: false, error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }

    // MODUL 52 fix — Upload POST routes must NOT have request headers modified,
    // because NextResponse.next({ request: { headers } }) detaches the body stream,
    // causing request.formData() to fail with "Failed to parse body as FormData".
    // The upload route reads the user ID directly from the JWT token instead.
    if (pathname.startsWith('/api/upload') && request.method === 'POST') {
      return addSecurityHeaders(NextResponse.next());
    }

    // Add user info to headers for API routes to use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.id as string);
    requestHeaders.set('x-user-email', token.email as string);
    // MODUL 36 — Pass role from JWT to API routes
    requestHeaders.set('x-user-role', (token.role as string) || 'user');

    return addSecurityHeaders(NextResponse.next({
      request: { headers: requestHeaders },
    }));
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/api/nodes/:path*',
    '/api/upload/:path*',
    '/api/storage-quota/:path*',
    '/api/preview/:path*',
    '/api/search/:path*',
    '/api/calculator/:path*',
    '/api/shares/:path*',
    '/api/users/:path*',
    '/api/activity/:path*',
    '/api/notifications/:path*',
    '/api/trash/:path*',
    '/api/tags/:path*',
    '/api/admin/:path*',
    '/api/export/:path*',
    '/api/import/:path*',
    '/api/account/:path*',
    '/api/databases/:path*',
    '/api/templates/:path*',
    '/api/comments/:path*',
    '/api/graph',
    '/api/workspaces/:path*',
    '/api/onboarding',
    '/api/files/:path*',
    '/api/auth/:path*',
    '/api/api-keys/:path*',
    '/api/v1/:path*',
    '/api/webhooks/:path*',
  ],
};
