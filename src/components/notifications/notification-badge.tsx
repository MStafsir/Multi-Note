'use client';

// ============================================================
// MODUL 20.3: Notification Badge — Bell icon with unread count
// Positioned in the workspace-layout header
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationDropdown } from '@/components/notifications/notification-dropdown';
import { NotificationPreferencesDialog } from '@/components/notifications/notification-preferences-dialog';

export function NotificationBadge() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const { data, isLoading } = useNotifications();

  const unreadCount = data?.unreadCount || 0;

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 relative"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              >
                <Bell className={`h-4 w-4 ${unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`} />
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}</p>
          </TooltipContent>
        </Tooltip>

        <PopoverContent
          className="w-80 p-0"
          align="end"
          sideOffset={8}
        >
          <NotificationDropdown open={popoverOpen} onOpenChange={setPopoverOpen} />
        </PopoverContent>
      </Popover>

      {/* Settings gear — opens preferences dialog */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setPreferencesOpen(true)}
            aria-label="Notification settings"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Notification settings</p>
        </TooltipContent>
      </Tooltip>

      {/* Notification Preferences Dialog */}
      <NotificationPreferencesDialog
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
      />
    </>
  );
}
