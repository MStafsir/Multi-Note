// ============================================================
// MODUL 47/48: Locale Switcher — UI component for switching locale
// Dropdown menu showing available locales with flag + label
// Compact design suitable for sidebar header or toolbar area
// 47.2 — Default 'id' (Bahasa Indonesia), fallback 'en'
// 48.1 — Only UI-chrome is translated, user-content stays original
// ============================================================

'use client';

import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocaleStore, LOCALE_CONFIG, type AppLocale } from '@/store/locale';
import { useLocale } from '@/hooks/use-locale';

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocaleStore();
  const { t } = useLocale('common');

  const currentConfig = LOCALE_CONFIG[locale];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs px-2"
          aria-label={t('languageSwitcher')}
        >
          <Globe className="h-3.5 w-3.5" />
          <span className="truncate max-w-[80px]">{currentConfig.flag} {currentConfig.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        {Object.entries(LOCALE_CONFIG).map(([loc, config]) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => setLocale(loc as AppLocale)}
            className={`flex items-center gap-2 cursor-pointer ${
              locale === loc ? 'bg-accent' : ''
            }`}
            aria-label={config.label}
          >
            <span className="text-base">{config.flag}</span>
            <span className="text-sm font-medium">{config.label}</span>
            {locale === loc && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
        <div className="px-2 py-1.5 text-xs text-muted-foreground border-t mt-1">
          {t('contentScopeNote')}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
