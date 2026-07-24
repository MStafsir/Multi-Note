'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/store/auth';
import { AuthForm } from '@/components/auth/auth-form';
import { WorkspaceLayout } from '@/components/workspace/workspace-layout';

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
