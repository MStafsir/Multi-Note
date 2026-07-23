// ============================================================
// MODUL 3: NextAuth.js Configuration
// Credentials provider (email/password) with bcrypt
// ============================================================

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { compare, hash } from './password';

export const authOptions: NextAuthOptions = {
  providers: [
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/', // We handle login inline on the main page
    error: '/',
  },
  secret: process.env.NEXTAUTH_SECRET || 'workspace-secret-key-dev',
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
