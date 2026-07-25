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
