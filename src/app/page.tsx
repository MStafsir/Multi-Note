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
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      });
    } else if (status === 'unauthenticated') {
      setUser(null);
    }
  }, [status, session, setUser, setLoading]);

  // Show loading state while checking session
  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show auth form if not authenticated
  if (!isAuthenticated || status === 'unauthenticated') {
    return <AuthForm />;
  }

  // Show workspace if authenticated
  return <WorkspaceLayout />;
}
