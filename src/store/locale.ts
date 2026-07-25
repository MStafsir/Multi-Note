// ============================================================
// MODUL 47.2: Locale Store — Zustand state management
// Default locale: Bahasa Indonesia (id), fallback: English (en)
// Persists to localStorage for cross-session consistency
// Client-side only — no URL dynamic segments (single-route constraint)
// ============================================================

import { create } from 'zustand';

export type AppLocale = 'id' | 'en';

// Available locales with display info
export const LOCALE_CONFIG: Record<AppLocale, { label: string; flag: string; direction: 'ltr' | 'rtl' }> = {
  id: { label: 'Bahasa Indonesia', flag: '🇮🇩', direction: 'ltr' },
  en: { label: 'English', flag: '🇺🇸', direction: 'ltr' },
};

// 47.2 — Default locale: Bahasa Indonesia (initial user base)
// 47.2 — Fallback locale: English
export const DEFAULT_LOCALE: AppLocale = 'id';
export const FALLBACK_LOCALE: AppLocale = 'en';

interface LocaleState {
  /** Current active locale */
  locale: AppLocale;
  /** Whether current locale is RTL (48.2) */
  isRTL: boolean;
  /** Set locale and persist to localStorage */
  setLocale: (locale: AppLocale) => void;
  /** Reset locale to default */
  resetLocale: () => void;
}

// Load persisted locale from localStorage
function getPersistedLocale(): AppLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem('app-locale');
    if (stored === 'id' || stored === 'en') return stored;
  } catch {
    // localStorage not available
  }
  return DEFAULT_LOCALE;
}

function getIsRTL(locale: AppLocale): boolean {
  return LOCALE_CONFIG[locale]?.direction === 'rtl';
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: getPersistedLocale(),
  isRTL: getIsRTL(getPersistedLocale()),

  setLocale: (locale: AppLocale) => {
    // Persist to localStorage
    try {
      localStorage.setItem('app-locale', locale);
    } catch {
      // localStorage not available
    }

    const isRTL = getIsRTL(locale);

    set({
      locale,
      isRTL,
    });

    // Update document direction attribute for RTL support (48.2)
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = locale;
    }
  },

  resetLocale: () => {
    try {
      localStorage.removeItem('app-locale');
    } catch {
      // localStorage not available
    }

    set({
      locale: DEFAULT_LOCALE,
      isRTL: getIsRTL(DEFAULT_LOCALE),
    });

    if (typeof document !== 'undefined') {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = DEFAULT_LOCALE;
    }
  },
}));
