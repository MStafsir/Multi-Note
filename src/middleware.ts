// ============================================================
// MODUL 3.2: Next.js Middleware — Protected Route Check
// Custom middleware to verify session without blocking API routes
// MODUL 13: Added share routes — link access route is public (no auth)
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect API routes (not auth routes)
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // MODUL 13 — Share link access route does NOT require auth
  // /api/shares/link/[token] is public access for view-level shares
  if (pathname.startsWith('/api/shares/link/')) {
    return NextResponse.next();
  }

  // MODUL 28 — Export download link route is public (token-based access)
  // /api/export/[token] does NOT require auth — token serves as auth
  if (pathname.match(/^\/api\/export\/[^/]+$/) && request.method === 'GET') {
    return NextResponse.next();
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
    pathname.startsWith('/api/admin') ||
    pathname === '/api/export' ||
    pathname.startsWith('/api/import') ||
    pathname.startsWith('/api/account') ||
    pathname.startsWith('/api/databases') ||
    pathname.startsWith('/api/templates') ||
    pathname.startsWith('/api/comments') ||
    pathname.startsWith('/api/graph')
  ) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || 'workspace-secret-key-dev',
    });

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Add user info to headers for API routes to use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.id as string);
    requestHeaders.set('x-user-email', token.email as string);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
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
  ],
};
