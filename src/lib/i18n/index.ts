// ============================================================
// MODUL 47-48: Core i18n Infrastructure
// Client-side locale management (no URL dynamic segments)
// Default locale: Bahasa Indonesia ('id'), fallback: English ('en')
//
// 47.2 — default 'id', fallback 'en'
// 47.3 — per-namespace translations (common/editor/dashboard)
// 47.4 — Intl API for date/number formatting
// 47.5 — missing key returns [missing: namespace.key]
// 48.1 — UI-chrome translated, user-content NOT auto-translated
// 48.2 — RTL support with CSS logical properties
// 48.4 — ICU pluralization via intl-messageformat (next-intl compat)
// ============================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { IntlMessageFormat } from 'intl-messageformat';
import { useLocaleStore, DEFAULT_LOCALE, FALLBACK_LOCALE, type AppLocale } from '@/store/locale';

// ============================================================
// Translation Loading — Dynamic imports of JSON per namespace
// 47.3 — per-namespace: common, editor, dashboard
// ============================================================

/** Supported translation namespaces */
export type Namespace = 'common' | 'editor' | 'dashboard';

/** Cache of loaded translations to avoid re-importing */
const translationCache: Record<string, Record<string, string>> = {};

/**
 * Load translations for a given locale and namespace.
 * Uses dynamic imports to load JSON files client-side.
 * Results are cached in memory for performance.
 */
async function loadTranslations(locale: AppLocale, namespace: Namespace): Promise<Record<string, string>> {
  const cacheKey = `${locale}/${namespace}`;

  // Return from cache if already loaded
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  try {
    // Dynamic import of translation JSON — Vite/Next.js compatible
    const mod = await import(`./locales/${locale}/${namespace}.json`);
    const messages = mod.default ?? mod;
    translationCache[cacheKey] = messages as Record<string, string>;
    return messages as Record<string, string>;
  } catch {
    // If locale file not found, try fallback locale per 47.2
    if (locale !== FALLBACK_LOCALE) {
      try {
        const fallbackKey = `${FALLBACK_LOCALE}/${namespace}`;
        if (translationCache[fallbackKey]) {
          return translationCache[fallbackKey];
        }
        const fallbackMod = await import(`./locales/${FALLBACK_LOCALE}/${namespace}.json`);
        const fallbackMessages = fallbackMod.default ?? fallbackMod;
        translationCache[fallbackKey] = fallbackMessages as Record<string, string>;
        return fallbackMessages as Record<string, string>;
      } catch {
        // Even fallback failed — return empty
        return {};
      }
    }
    return {};
  }
}

// ============================================================
// getTranslations — Load and return translator for locale+namespace
// ============================================================

/**
 * Get a translation function for a specific locale and namespace.
 * Async because it needs to dynamically load the JSON file.
 *
 * @param locale — Target locale ('id' or 'en')
 * @param namespace — Translation namespace ('common', 'editor', 'dashboard')
 * @returns Object with `t()` function for key lookup
 */
export async function getTranslations(locale: AppLocale, namespace: Namespace) {
  const messages = await loadTranslations(locale, namespace);

  /**
   * Translate a key within this namespace.
   * Supports ICU message format with variables via `{variableName}` syntax.
   * Missing keys return `[missing: namespace.key]` per 47.5.
   *
   * @param key — Translation key within the namespace
   * @param variables — Optional ICU variables for interpolation
   */
  function t(key: string, variables?: Record<string, string | number>): string {
    const message = messages[key];
    if (message === undefined || message === null) {
      // 47.5 — Missing key handling: return key name explicitly
      return `[missing: ${namespace}.${key}]`;
    }

    // If no variables needed, return plain string
    if (!variables) {
      return message;
    }

    // Use IntlMessageFormat for ICU interpolation (48.4 compat)
    try {
      const formatter = new IntlMessageFormat(message, locale);
      return formatter.format(variables) as string;
    } catch {
      // Fallback: if ICU formatting fails, return raw message
      return message;
    }
  }

  return { t, messages };
}

// ============================================================
// t — Simple synchronous key lookup (requires pre-loaded translations)
// ============================================================

/**
 * Simple synchronous translation key lookup.
 * If translations haven't been loaded yet, returns the missing key format.
 * Prefer `getTranslations()` or `useI18n()` for full functionality.
 *
 * @param key — Dot-separated key like "common.save" or simple key like "save"
 * @param locale — Target locale
 * @param namespace — Namespace to look in (defaults to 'common')
 */
export function t(key: string, locale: AppLocale, namespace: Namespace = 'common'): string {
  const cacheKey = `${locale}/${namespace}`;
  const messages = translationCache[cacheKey];

  if (!messages) {
    // Translations not loaded yet
    return `[missing: ${namespace}.${key}]`;
  }

  const message = messages[key];
  if (message === undefined || message === null) {
    // 47.5 — Missing key handling
    return `[missing: ${namespace}.${key}]`;
  }

  return message;
}

// ============================================================
// formatDate — Intl.DateTimeFormat (47.4)
// ============================================================

/**
 * Format a date using the native Intl.DateTimeFormat API.
 * Per 47.4 — uses Intl API, not external date-fns for formatting.
 *
 * @param date — Date to format (Date object, ISO string, or timestamp)
 * @param locale — Target locale for formatting
 * @param options — Intl.DateTimeFormat options (defaults to medium date)
 */
export function formatDate(
  date: Date | string | number,
  locale: AppLocale = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '[invalid date]';
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
  } catch {
    // Fallback to English formatting if locale fails
    return new Intl.DateTimeFormat(FALLBACK_LOCALE, defaultOptions).format(dateObj);
  }
}

// ============================================================
// formatNumber — Intl.NumberFormat (47.4)
// ============================================================

/**
 * Format a number using the native Intl.NumberFormat API.
 * Per 47.4 — uses Intl API for number formatting.
 *
 * @param num — Number to format
 * @param locale — Target locale for formatting
 * @param options — Intl.NumberFormat options (style, currency, etc.)
 */
export function formatNumber(
  num: number,
  locale: AppLocale = DEFAULT_LOCALE,
  options?: Intl.NumberFormatOptions
): string {
  try {
    return new Intl.NumberFormat(locale, options).format(num);
  } catch {
    // Fallback to English formatting if locale fails
    return new Intl.NumberFormat(FALLBACK_LOCALE, options).format(num);
  }
}

// ============================================================
// pluralize — ICU pluralization via intl-messageformat (48.4)
// ============================================================

/**
 * Pluralize a message using ICU plural format.
 * Per 48.4 — uses ICU {count, plural, ...} format via intl-messageformat.
 *
 * Example:
 *   pluralize(1, 'id', '{count} item', '{count} item')  — uses ICU format
 *   pluralize(5, 'id', '{count} item', '{count} item')  — uses ICU format
 *
 * The singularKey/pluralKey should be ICU-formatted strings containing
 * {count} placeholder. For full ICU plural rules:
 *   "{count, plural, one{1 item} other{# items}}"
 *
 * @param count — The count to determine plural form
 * @param locale — Locale for plural rules
 * @param singularKey — ICU message for singular form (or raw key in namespace)
 * @param pluralKey — ICU message for plural form (or raw key in namespace)
 */
export function pluralize(
  count: number,
  locale: AppLocale,
  singularKey: string,
  pluralKey: string
): string {
  // Build ICU plural message
  const icuMessage = `{count, plural, one{${singularKey}} other{${pluralKey}}}`;

  try {
    const formatter = new IntlMessageFormat(icuMessage, locale);
    return formatter.format({ count }) as string;
  } catch {
    // Fallback: simple pluralization logic
    if (count === 1) {
      return singularKey.replace(/\{count\}/g, String(count));
    }
    return pluralKey.replace(/\{count\}/g, String(count));
  }
}

/**
 * Advanced pluralize using full ICU plural categories.
 * Supports: zero, one, two, few, many, other
 *
 * @param count — The count for plural determination
 * @param locale — Locale for plural rules
 * @param pluralForms — Object mapping plural categories to their messages
 *   e.g. { one: '1 item', other: '# items' }
 */
export function pluralizeAdvanced(
  count: number,
  locale: AppLocale,
  pluralForms: Record<string, string>
): string {
  const parts = Object.entries(pluralForms)
    .map(([category, message]) => `${category}{${message}}`)
    .join(' ');
  const icuMessage = `{count, plural, ${parts}}`;

  try {
    const formatter = new IntlMessageFormat(icuMessage, locale);
    return formatter.format({ count }) as string;
  } catch {
    // Fallback to 'other' or first available form
    const fallback = pluralForms.other ?? pluralForms.many ?? Object.values(pluralForms)[0] ?? String(count);
    return fallback.replace(/#/g, String(count));
  }
}

// ============================================================
// useI18n — React hook combining Zustand locale + translations
// ============================================================

/**
 * React hook that combines Zustand locale state with translation loading.
 * Provides: locale, setLocale, t, formatDate, formatNumber, pluralize
 * Handles async loading of translations and provides a ready flag.
 *
 * Usage:
 *   const { t, locale, setLocale, isReady } = useI18n('editor');
 *   <span>{t('bold')}</span>
 */
export function useI18n(namespace: Namespace = 'common') {
  const { locale, isRTL, setLocale, resetLocale } = useLocaleStore();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [isReady, setIsReady] = useState(false);

  // Load translations whenever locale or namespace changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsReady(false);
      const loaded = await loadTranslations(locale, namespace);
      if (!cancelled) {
        setMessages(loaded);
        setIsReady(true);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [locale, namespace]);

  // Translation function for this namespace
  const tFn = useCallback(
    (key: string, variables?: Record<string, string | number>): string => {
      const message = messages[key];
      if (message === undefined || message === null) {
        // 47.5 — Missing key handling: return key name explicitly
        return `[missing: ${namespace}.${key}]`;
      }

      if (!variables) {
        return message;
      }

      // ICU interpolation via IntlMessageFormat (48.4)
      try {
        const formatter = new IntlMessageFormat(message, locale);
        return formatter.format(variables) as string;
      } catch {
        return message;
      }
    },
    [messages, locale, namespace]
  );

  // Date formatting bound to current locale
  const formatDateFn = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
      return formatDate(date, locale, options);
    },
    [locale]
  );

  // Number formatting bound to current locale
  const formatNumberFn = useCallback(
    (num: number, options?: Intl.NumberFormatOptions): string => {
      return formatNumber(num, locale, options);
    },
    [locale]
  );

  // Pluralize bound to current locale
  const pluralizeFn = useCallback(
    (count: number, singularKey: string, pluralKey: string): string => {
      return pluralize(count, locale, singularKey, pluralKey);
    },
    [locale]
  );

  // Advanced pluralize bound to current locale
  const pluralizeAdvancedFn = useCallback(
    (count: number, pluralForms: Record<string, string>): string => {
      return pluralizeAdvanced(count, locale, pluralForms);
    },
    [locale]
  );

  return useMemo(
    () => ({
      locale,
      isRTL,
      setLocale,
      resetLocale,
      t: tFn,
      formatDate: formatDateFn,
      formatNumber: formatNumberFn,
      pluralize: pluralizeFn,
      pluralizeAdvanced: pluralizeAdvancedFn,
      isReady,
      namespace,
    }),
    [
      locale,
      isRTL,
      setLocale,
      resetLocale,
      tFn,
      formatDateFn,
      formatNumberFn,
      pluralizeFn,
      pluralizeAdvancedFn,
      isReady,
      namespace,
    ]
  );
}

// ============================================================
// RTL Helpers — 48.2 CSS logical properties support
// ============================================================

/**
 * Get the HTML dir attribute value for the current locale.
 * Returns 'rtl' for RTL locales, 'ltr' otherwise.
 */
export function getDir(locale: AppLocale): 'rtl' | 'ltr' {
  return locale === 'ar' || locale === 'he' || locale === 'fa' ? 'rtl' : 'ltr';
}

/**
 * CSS logical property mappings for RTL compatibility (48.2).
 * Use these mappings when converting physical CSS properties to logical ones.
 *
 * Physical → Logical:
 *   margin-left   → margin-inline-start
 *   margin-right  → margin-inline-end
 *   padding-left  → padding-inline-start
 *   padding-right → padding-inline-end
 *   left          → inset-inline-start
 *   right         → inset-inline-end
 *   border-left   → border-inline-start
 *   border-right  → border-inline-end
 */
export const CSS_LOGICAL_MAP: Record<string, string> = {
  'margin-left': 'margin-inline-start',
  'margin-right': 'margin-inline-end',
  'padding-left': 'padding-inline-start',
  'padding-right': 'padding-inline-end',
  'left': 'inset-inline-start',
  'right': 'inset-inline-end',
  'border-left': 'border-inline-start',
  'border-right': 'border-inline-end',
  'text-align-left': 'text-align: start',
  'text-align-right': 'text-align: end',
};

/**
 * Generate Tailwind CSS classes that respect RTL via logical properties.
 * Returns a string of Tailwind classes suitable for the current direction.
 *
 * Example:
 *   getRTLClasses('ml-4', 'mr-4') → 'ml-4 ms-4' (with logical equivalents)
 */
export function getRTLClasses(
  locale: AppLocale,
  ltrClass: string,
  rtlClass: string
): string {
  const dir = getDir(locale);
  return dir === 'rtl' ? rtlClass : ltrClass;
}
