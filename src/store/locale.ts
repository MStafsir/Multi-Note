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

// Default locale per 47.2 [FLAG: VERIFY] — Bahasa Indonesia for initial user base
const DEFAULT_LOCALE: AppLocale = 'id';

interface LocaleState {
  /** Current active locale */
  locale: AppLocale;
  /** Set locale and persist to localStorage */
  setLocale: (locale: AppLocale) => void;
  /** Get text direction for current locale (48.2 — RTL consideration) */
  direction: 'ltr' | 'rtl';
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

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: getPersistedLocale(),
  direction: LOCALE_CONFIG[getPersistedLocale()].direction,

  setLocale: (locale: AppLocale) => {
    // Persist to localStorage
    try {
      localStorage.setItem('app-locale', locale);
    } catch {
      // localStorage not available
    }

    set({
      locale,
      direction: LOCALE_CONFIG[locale].direction,
    });

    // Update document direction attribute for RTL support (48.2)
    if (typeof document !== 'undefined') {
      document.documentElement.dir = LOCALE_CONFIG[locale].direction;
      document.documentElement.lang = locale;
    }
  },
}));
