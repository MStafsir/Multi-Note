'use client';

// ============================================================
// MODUL 26.1: Root-level Next.js Error Boundary (error.tsx)
// Catches errors at the root route level and shows a proper
// recovery UI. This prevents global white-screen crashes.
//
// Next.js automatically renders error.tsx when an error occurs
// in the route segment. It must be a client component.
// ============================================================

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/error-reporter';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Report the error to our logging system
  useEffect(() => {
    reportError(error, {
      route: typeof window !== 'undefined' ? window.location.pathname : '/',
      action: 'page_render',
      componentName: 'RootErrorBoundary',
      additionalData: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        {/* Error icon */}
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>

        {/* Error message */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            We encountered an unexpected error. Your data is safe — you can try
            reloading the page or going back to the home screen.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground mt-1">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        {/* Recovery actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <Button
            onClick={reset}
            className="flex-1 min-h-[44px]"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = '/';
            }}
            className="flex-1 min-h-[44px]"
          >
            <Home className="h-4 w-4 mr-2" />
            Go home
          </Button>
        </div>

        {/* Debug info (collapsed, accessible via aria) */}
        <details className="text-xs text-muted-foreground w-full">
          <summary className="cursor-pointer hover:text-foreground transition-colors">
            Technical details
          </summary>
          <pre className="mt-2 p-3 bg-muted rounded-lg overflow-auto text-xs max-h-48">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>
      </div>
    </div>
  );
}
