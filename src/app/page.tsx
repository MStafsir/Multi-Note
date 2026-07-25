'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/store/auth';
import { AuthForm } from '@/components/auth/auth-form';

// WorkspaceLayout is VERY heavy (100+ component tree) — loaded dynamically
// to prevent OOM during initial page compilation. Only compiled when
// the user is actually authenticated and needs the workspace view.
const WorkspaceLayout = dynamic(
  () => import('@/components/workspace/workspace-layout').then(m => ({ default: m.WorkspaceLayout })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading workspace...</div>
      </div>
    ),
  }
);

export default function Home() {
  const { data: session, status } = useSession();
  const { user, isAuthenticated, setUser, setLoading, isLoading } = useAuthStore();

  // Sync NextAuth session with Zustand auth store
  useEffect(() => {
    if (status === 'loading') {
      setLoading(true);
      return;
    }

    if (status === 'authenticated' && session?.user) {
      setUser({
        id: session.user.id as string,
        email: session.user.email as string,
        name: session.user.name as string | null,
        role: (session.user as Record<string, unknown>).role as 'user' | 'admin' || 'user', // MODUL 36.1
      });
    } else if (status === 'unauthenticated') {
      // Only clear auth if Zustand doesn't already have authenticated user
      // This prevents clearing manually-set auth after signIn with redirect:false
      if (!isAuthenticated) {
        setUser(null);
      }
    }
  }, [status, session, setUser, setLoading, isAuthenticated]);

  // Show loading state while checking session
  if (isLoading && status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show auth form if user is NOT authenticated
  // Use AND logic: both Zustand and NextAuth must indicate unauthenticated
  // This handles the race condition after signIn with redirect:false
  if (!isAuthenticated && status !== 'authenticated') {
    return <AuthForm />;
  }

  // Show workspace if authenticated (either via Zustand or NextAuth session)
  return <WorkspaceLayout />;
}
