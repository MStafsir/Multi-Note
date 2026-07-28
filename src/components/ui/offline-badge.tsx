'use client';

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { Badge } from '@/components/ui/badge';

export function OfflineBadge() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) {
    // When online: subtle green indicator dot
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
        aria-label="Online"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      </span>
    );
  }

  // When offline: orange/red badge with WifiOff icon and "Offline" text
  return (
    <Badge variant="outline" className="border-orange-500/50 text-orange-600 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400">
      <WifiOff className="h-3 w-3" />
      Offline
    </Badge>
  );
}
