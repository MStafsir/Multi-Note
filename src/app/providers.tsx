'use client';

// ============================================================
// MODUL 47: Providers — wraps all app-level providers
// Added locale initialization — sets document dir/lang on mount
// 48.2 — RTL: document.documentElement.dir updated on locale change
// 55.3 — SW: production-only registration + dev-mode active unregistration
// ============================================================

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { useState, useEffect } from 'react';
import { useLocaleStore, DEFAULT_LOCALE, FALLBACK_LOCALE, type AppLocale } from '@/store/locale';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            retry: 1,
          },
        },
      })
  );

  // MODUL 47 — Initialize locale from persisted storage on mount
  const { locale, isRTL } = useLocaleStore();

  useEffect(() => {
    // Set document direction and language on mount (48.2 RTL support)
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale, isRTL]);

  // ============================================================
  // 55.3 — Service Worker Registration & Unregistration
  //
  // PRODUCTION: Register /sw.js with error handling.
  // DEVELOPMENT: Actively UNREGISTER any existing SW to prevent
  //   stale SW from a previous production build session from
  //   intercepting dev-server requests (HMR, /_next/static/*, etc.)
  //   which causes clone() errors and infinite Fast Refresh loops.
  //
  // FLAG: VERIFY — process.env.NODE_ENV is replaced at build time
  //   by Next.js bundler. In `next dev`, it's 'development'.
  //   In `next build` + `next start`, it's 'production'.
  //   This is the canonical way to detect the environment.
  // ============================================================
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // Production: register the SW
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
          });
          console.log('[SW] Registered successfully, scope:', registration.scope);
        } catch (error) {
          console.warn('[SW] Registration failed:', error);
        }
      };

      // Register after the page loads to avoid blocking critical rendering
      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }

      return () => {
        window.removeEventListener('load', registerSW);
      };
    } else {
      // Development: actively unregister any existing SW
      // This prevents stale SW from previous production sessions
      // from intercepting dev-server requests and causing errors.
      const unregisterSW = async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
            console.log('[SW] Unregistered stale SW:', registration.scope);
          }
          // Also clear all SW caches to prevent stale cached responses
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (const name of cacheNames) {
              await caches.delete(name);
              console.log('[SW] Cleared cache:', name);
            }
          }
        } catch (error) {
          // Silently ignore — SW API might not be available
        }
      };

      unregisterSW();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
