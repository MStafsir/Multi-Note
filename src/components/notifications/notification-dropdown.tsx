'use client';

// ============================================================
// MODUL 20.3: Notification Dropdown — Shows recent notifications
// Props: { open: boolean, onOpenChange: (open: boolean) => void }
// ============================================================

import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  AlertTriangle,
  MessageSquare,
  AtSign,
  Bell,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  useNotifications,
  useMarkNotificationsRead,
  type NotificationEntry,
  type NotificationType,
} from '@/hooks/use-notifications';
import { useFileTreeStore } from '@/store/file-tree';

interface NotificationDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Map notification type to icon
function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'share_received':
      return <Share2 className="h-4 w-4 text-purple-500" />;
    case 'quota_warning':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'comment_added':
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case 'mention':
      return <AtSign className="h-4 w-4 text-emerald-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

// Build notification message from payload
function buildNotificationMessage(entry: NotificationEntry): string {
  const payload = entry.payload || {};

  switch (entry.type) {
    case 'share_received':
      return `${payload.sharedByName || 'Someone'} shared "${payload.nodeName || 'a file'}" with you`;
    case 'quota_warning':
      return `Storage usage is at ${payload.percentage || '90'}% — consider freeing up space`;
    case 'comment_added':
      return `${payload.commenterName || 'Someone'} commented on "${payload.nodeName || 'a file'}"`;
    case 'mention':
      return `${payload.mentionerName || 'Someone'} mentioned you in "${payload.nodeName || 'a file'}"`;
    default:
      return 'New notification';
  }
}

export function NotificationDropdown({ open, onOpenChange }: NotificationDropdownProps) {
  const { data, isLoading } = useNotifications();
  const markReadMutation = useMarkNotificationsRead();
  const { setCurrentFolder, flatNodes } = useFileTreeStore();

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Mark all as read
  const handleMarkAllRead = () => {
    markReadMutation.mutate({ markAll: true });
  };

  // Click notification → dismiss dropdown + navigate to relevant node
  const handleNotificationClick = (entry: NotificationEntry) => {
    // Mark this notification as read
    markReadMutation.mutate({ notificationIds: [entry.id] });

    // Close the dropdown
    onOpenChange(false);

    // Navigate if the notification references a node
    const payload = entry.payload || {};
    const nodeId = payload.nodeId as string | undefined;
    const nodeType = payload.nodeType as string | undefined;

    if (nodeId) {
      // Try to navigate to the node's parent folder
      const node = flatNodes.get(nodeId);
      if (node) {
        if (node.type === 'folder') {
          setCurrentFolder(nodeId, []);
        } else if (node.parentId) {
          setCurrentFolder(node.parentId, []);
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted mb-3">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No notifications</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header — mark all as read */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleMarkAllRead}
            disabled={markReadMutation.isPending}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notification list */}
      <ScrollArea className="max-h-72">
        <AnimatePresence initial={false}>
          {notifications.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03 }}
              className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleNotificationClick(entry)}
            >
              {/* Icon */}
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted shrink-0">
                {getNotificationIcon(entry.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${!entry.isRead ? 'font-semibold' : 'text-muted-foreground'}`}>
                  {buildNotificationMessage(entry)}
                </p>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                </span>
              </div>

              {/* Read/unread dot */}
              {!entry.isRead && (
                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-2" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </ScrollArea>

      {/* Footer */}
      {unreadCount > 0 && (
        <Separator />
      )}
    </div>
  );
}
