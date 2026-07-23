'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { WifiOff } from 'lucide-react';

interface CollabUser {
  userId: string;
  userName: string;
}

interface PresenceIndicatorProps {
  connectedUsers: CollabUser[];
  isConnected: boolean;
  maxVisible?: number;
}

// Color palette for user avatars (avoiding indigo/blue)
const AVATAR_COLORS = [
  'bg-emerald-600 text-white',
  'bg-orange-500 text-white',
  'bg-rose-500 text-white',
  'bg-amber-500 text-white',
  'bg-teal-600 text-white',
  'bg-violet-500 text-white',
  'bg-pink-500 text-white',
  'bg-lime-600 text-white',
];

function getUserColor(userId: string): string {
  // Simple hash-based color assignment
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function PresenceIndicator({
  connectedUsers,
  isConnected,
  maxVisible = 3,
}: PresenceIndicatorProps) {
  const visibleUsers = connectedUsers.slice(0, maxVisible);
  const overflowCount = connectedUsers.length - maxVisible;

  return (
    <div className="flex items-center gap-2">
      {/* Connection status indicator */}
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <WifiOff className="h-3.5 w-3.5" />
          <span>Reconnecting...</span>
        </motion.div>
      )}

      {/* User avatars */}
      <AnimatePresence mode="popLayout">
        {visibleUsers.map((user) => (
          <motion.div
            key={user.userId}
            initial={{ opacity: 0, scale: 0.5, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -4 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            <Avatar className="h-7 w-7 border-2 border-background shadow-sm">
              <AvatarFallback
                className={`${getUserColor(user.userId)} text-xs font-semibold`}
              >
                {getInitials(user.userName)}
              </AvatarFallback>
            </Avatar>
            {/* Tooltip-like name label */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-popover text-popover-foreground text-[10px] font-medium rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none hidden sm:block">
              {user.userName}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Overflow count badge */}
      {overflowCount > 0 && (
        <Badge
          variant="secondary"
          className="h-7 min-w-[28px] text-xs font-medium px-1.5"
        >
          +{overflowCount}
        </Badge>
      )}
    </div>
  );
}
