'use client';

// ============================================================
// MODUL 26.1/26.2: Reusable React Error Boundary (Class Component)
// Next.js functional components can't catch errors from children.
// This class-based Error Boundary isolates failures to individual
// components, preventing global crash.
//
// Usage:
//   <ErrorBoundary fallback={NoteEditorError}>
//     <NoteEditor nodeId="..." />
//   </ErrorBoundary>
// ============================================================

import React from 'react';
import { reportError } from '@/lib/error-reporter';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorBoundaryFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  context?: {
    componentName?: string;
    action?: string;
  };
}

export interface ErrorBoundaryFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: false,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Update state to show fallback UI
    this.setState({ hasError: true, error });

    // Report the error with context
    reportError(error, {
      componentName: this.props.context?.componentName || 'UnknownComponent',
      action: this.props.context?.action || 'render',
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
      additionalData: {
        componentStack: errorInfo.componentStack,
      },
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      // Default fallback: generic error message with retry
      return (
        <div className="flex flex-col items-center justify-center p-6 min-h-[200px] rounded-lg border border-border bg-muted/30">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <svg
              className="h-6 w-6 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            Something went wrong
          </p>
          <p className="text-xs text-muted-foreground mb-4 max-w-md text-center">
            {this.state.error.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.resetError}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors min-h-[44px]"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
