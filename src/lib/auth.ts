// ============================================================
// MODUL 3: NextAuth.js Configuration
// Credentials provider (email/password) with bcrypt
// ============================================================

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { db } from '@/lib/db';
import { compare } from './password';
import { logger } from '@/lib/logger';

// ============================================================
// MODUL 49.9: NEXTAUTH_SECRET — fatal error at boot if missing
// No fallback string permitted. Zero tolerance.
// ============================================================
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
if (!NEXTAUTH_SECRET) {
  throw new Error(
    'FATAL: NEXTAUTH_SECRET environment variable is not set. ' +
    'Application cannot start without a valid auth secret. ' +
    'Set NEXTAUTH_SECRET in your .env file (generate with: openssl rand -base64 32)'
  );
}

export { NEXTAUTH_SECRET };

export const authOptions: NextAuthOptions = {
  providers: [
    // MODUL 49.15: Google OAuth provider — conditional activation
    // Only enabled if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in .env
    // IMPORTANT: Redirect URI must match the domain registered in Google Cloud Console.
    // For sandbox: not configured (no env vars set). For deployment: set env vars and
    // register redirect URI (e.g., https://your-domain.com/api/auth/callback/google)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          authorization: {
            params: {
              prompt: 'consent',
              access_type: 'offline',
              response_type: 'code',
            },
          },
        })]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          throw new Error('Invalid email or password');
        }

        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error('Invalid email or password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  // MODUL 49.15: Handle Google OAuth sign-in — create user+profile if new
  events: {
    async signIn({ user, account }) {
      // Google OAuth creates user on first sign-in if not existing
      if (account?.provider === 'google' && user.email) {
        const existingUser = await db.user.findUnique({
          where: { email: user.email },
        });

        if (!existingUser) {
          // Create new user + profile for Google OAuth first-time sign-in
          logger.info('google_oauth_new_user', { email: user.email }, null);
          await db.$transaction(async (tx) => {
            const newUser = await tx.user.create({
              data: {
                email: user.email,
                name: user.name || null,
                image: user.image || null,
                profile: {
                  create: {
                    role: 'user',
                    storageUsedBytes: BigInt(0),
                    quotaLimitBytes: BigInt(5368709120),
                  },
                },
              },
            });
            // Create Account record for OAuth linkage
            await tx.account.create({
              data: {
                userId: newUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token || null,
                access_token: account.access_token || null,
                expires_at: account.expires_at || null,
                token_type: account.token_type || null,
                scope: account.scope || null,
                id_token: account.id_token || null,
                session_state: account.session_state || null,
              },
            });
          });
        } else {
          // Link Google account to existing user if not already linked
          const existingAccount = await db.account.findFirst({
            where: { userId: existingUser.id, provider: 'google' },
          });
          if (!existingAccount) {
            await db.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token || null,
                access_token: account.access_token || null,
                expires_at: account.expires_at || null,
                token_type: account.token_type || null,
                scope: account.scope || null,
                id_token: account.id_token || null,
                session_state: account.session_state || null,
              },
            });
          }
        }
      }
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 1 * 60 * 60, // 1 hour access token (3.3)
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        // MODUL 36.1: Include role from profile in JWT token
        const profile = await db.profile.findUnique({
          where: { userId: user.id },
          select: { role: true },
        });
        token.role = profile?.role || 'user';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        // MODUL 36.1: Include role in session for client-side admin detection
        (session.user as Record<string, unknown>).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/', // We handle login inline on the main page
    error: '/',
  },
  secret: NEXTAUTH_SECRET,
};

// Helper: Get current user from session in API routes
export async function getCurrentUser(request: Request): Promise<{ id: string; email: string; name: string | null } | null> {
  // For API routes, we'll use a simpler token-based approach
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    // Try cookie-based auth
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    // Parse session token from cookie
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith('next-auth.session-token=') || c.startsWith('__Secure-next-auth.session-token='));
    if (!sessionCookie) return null;

    // We'll decode this in middleware, for API routes we return null and let middleware handle it
    return null;
  }

  // Bearer token approach for API
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  return null; // Will be handled by session middleware
}
