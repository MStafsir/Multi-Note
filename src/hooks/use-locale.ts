// ============================================================
// MODUL 47/48: useLocale hook — convenience wrapper
// Combines Zustand locale state + i18n translation function
// Easy to use in components: const { t, locale, setLocale } = useLocale('dashboard')
// ============================================================

'use client';

import { useI18n, type Namespace } from '@/lib/i18n';

/**
 * Convenience hook for locale + translations.
 * Same as useI18n but with a simpler name.
 *
 * Usage:
 *   const { t, locale, setLocale, formatDate, formatNumber, pluralize } = useLocale('dashboard');
 *   <span>{t('myWorkspace')}</span>
 *   <span>{formatDate(new Date())}</span>
 *   <span>{pluralize(5, '1 item', '# items')}</span>
 *
 * 48.1 — UI-chrome translated via t(); user-content NOT translated
 * 48.4 — pluralize uses ICU format
 * 47.4 — formatDate/formatNumber use Intl API
 * 47.5 — missing keys return [missing: namespace.key]
 */
export function useLocale(namespace: Namespace = 'common') {
  return useI18n(namespace);
}
