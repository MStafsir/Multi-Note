'use client';

// ============================================================
// MODUL 20.5: Notification Preferences Dialog
// Settings dialog for notification channel preferences
// Four rows: share_received, comment_added, mention, quota_warning
// ============================================================

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  type NotificationChannel,
  type NotificationPreferences,
} from '@/hooks/use-notifications';

interface NotificationPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Preference row configuration
const PREFERENCE_ROWS = [
  { key: 'shareReceived' as keyof NotificationPreferences, label: 'Share received', description: 'When someone shares a file or folder with you' },
  { key: 'commentAdded' as keyof NotificationPreferences, label: 'Comment added', description: 'When someone comments on your shared item' },
  { key: 'mention' as keyof NotificationPreferences, label: 'Mention', description: 'When someone mentions you in a note' },
  { key: 'quotaWarning' as keyof NotificationPreferences, label: 'Quota warning', description: 'When your storage usage exceeds 90%' },
] as const;

// Channel display labels
const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: 'In-App',
  email: 'Email',
  both: 'Both',
  off: 'Off',
};

// Default preferences (used before data loads)
const DEFAULT_PREFS: NotificationPreferences = {
  shareReceived: 'in_app',
  commentAdded: 'in_app',
  mention: 'in_app',
  quotaWarning: 'both',
};

export function NotificationPreferencesDialog({ open, onOpenChange }: NotificationPreferencesDialogProps) {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();

  // Track local edits separately — merge with fetched preferences
  const [edits, setEdits] = useState<Partial<NotificationPreferences>>({});

  // Derive display preferences: edits override fetched data, fallback to defaults
  const displayPrefs: NotificationPreferences = {
    shareReceived: edits.shareReceived ?? preferences?.shareReceived ?? DEFAULT_PREFS.shareReceived,
    commentAdded: edits.commentAdded ?? preferences?.commentAdded ?? DEFAULT_PREFS.commentAdded,
    mention: edits.mention ?? preferences?.mention ?? DEFAULT_PREFS.mention,
    quotaWarning: edits.quotaWarning ?? preferences?.quotaWarning ?? DEFAULT_PREFS.quotaWarning,
  };

  // Save handler — submit full merged preferences
  const handleSave = () => {
    updateMutation.mutate(displayPrefs, {
      onSuccess: () => {
        setEdits({});
        onOpenChange(false);
      },
    });
  };

  // Update single preference channel
  const handleChange = (key: keyof NotificationPreferences, value: NotificationChannel) => {
    setEdits(prev => ({ ...prev, [key]: value }));
  };

  // Reset edits when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setEdits({});
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notification Preferences</DialogTitle>
          <DialogDescription>
            Choose how you want to receive each type of notification.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {PREFERENCE_ROWS.map((row) => (
              <div key={row.key}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.description}</p>
                  </div>
                  <Select
                    value={displayPrefs[row.key]}
                    onValueChange={(value: string) => handleChange(row.key, value as NotificationChannel)}
                  >
                    <SelectTrigger className="w-[120px]" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CHANNEL_LABELS).map(([channel, label]) => (
                        <SelectItem key={channel} value={channel}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator className="mt-3" />
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || isLoading}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
