'use client';

// ============================================================
// MODUL 47: Providers — wraps all app-level providers
// Added locale initialization — sets document dir/lang on mount
// 48.2 — RTL: document.documentElement.dir updated on locale change
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
  // Service Worker Registration — production only
  // Serwist compiles src/app/sw.ts → public/sw.js during build,
  // but does NOT auto-inject registration when `disable: isDev`.
  // In dev mode, no SW should be registered (no sw.js exists).
  // In production, register with error handling to prevent
  // "ServiceWorker script evaluation failed" from crashing the app.
  // ============================================================
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

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
