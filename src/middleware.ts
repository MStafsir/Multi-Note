// ============================================================
// MODUL 3.2: Next.js Middleware — Protected Route Check
// Custom middleware to verify session without blocking API routes
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

  // Check for protected API routes
  if (
    pathname.startsWith('/api/nodes') ||
    pathname.startsWith('/api/upload') ||
    pathname.startsWith('/api/storage-quota') ||
    pathname.startsWith('/api/preview')
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
  ],
};
