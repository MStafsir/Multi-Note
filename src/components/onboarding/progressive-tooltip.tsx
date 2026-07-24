'use client';

// ============================================================
// MODUL 39.4: Progressive Disclosure Tooltips
// Contextual tooltips that introduce advanced features
// when user first reaches them
// Shows only once per feature (tracked in checklist progress)
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { X, Command, Table2, GitBranch } from 'lucide-react';

interface ProgressiveTooltipProps {
  /** Unique feature identifier — matches checklist progress keys */
  featureKey: string;
  /** The target element to attach the tooltip to */
  children: React.ReactNode;
  /** Tooltip content to show */
  content: string;
  /** Optional icon for the tooltip */
  icon?: React.ReactNode;
  /** Side placement */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Callback when tooltip is dismissed */
  onDismissed?: () => void;
  /** Whether this feature has already been seen (from onboarding state) */
  alreadySeen?: boolean;
  /** Whether to force-show (for testing) */
  forceShow?: boolean;
}

// Feature tooltip definitions for convenience
export const FEATURE_TIPS: Record<string, { content: string; icon: React.ReactNode }> = {
  command_palette: {
    content: 'Quick access to all actions — Press Ctrl+K',
    icon: <Command className="h-4 w-4" />,
  },
  database_block: {
    content: 'Create structured data tables inside your notes',
    icon: <Table2 className="h-4 w-4" />,
  },
  graph_view: {
    content: 'Visualize connections between your notes',
    icon: <GitBranch className="h-4 w-4" />,
  },
};

export function ProgressiveTooltip({
  featureKey,
  children,
  content,
  icon,
  side = 'bottom',
  onDismissed,
  alreadySeen = false,
  forceShow = false,
}: ProgressiveTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
    // Mark the step as seen in onboarding
    markFeatureSeen(featureKey);
    onDismissed?.();
  }, [featureKey, onDismissed]);

  // Show the tooltip if the feature hasn't been seen yet
  useEffect(() => {
    if (!alreadySeen && !dismissed && (forceShow || !alreadySeen)) {
      // Delay showing to avoid overwhelming the user
      const timer = setTimeout(() => {
        setVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [alreadySeen, dismissed, forceShow]);

  // Auto-hide after a reasonable time (15 seconds)
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [visible, handleDismiss]);

  // If the feature has already been seen or was dismissed, just render children
  if (alreadySeen || (dismissed && !forceShow)) {
    return <>{children}</>;
  }

  return (
    <Tooltip open={visible} onOpenChange={(open) => {
      if (!open && visible) {
        handleDismiss();
      }
    }}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className="flex items-center gap-2 px-3 py-2 max-w-xs">
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="text-sm">{content}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 ml-1 min-h-[44px] min-w-[44px]"
          onClick={handleDismiss}
          aria-label="Dismiss tooltip"
        >
          <X className="h-3 w-3" />
        </Button>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Mark a feature as seen in onboarding state
 * Uses the checklist progress to track which features have been introduced
 */
async function markFeatureSeen(featureKey: string): Promise<void> {
  try {
    // We use a special prefix 'tip_seen_' to differentiate from checklist steps
    // But we also mark the corresponding checklist step if applicable
    const checklistMap: Record<string, string> = {
      command_palette: 'use_command_palette',
      // Other tips don't have a direct checklist mapping
    };

    const checklistStep = checklistMap[featureKey];
    if (checklistStep) {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistStep }),
      });
    }
  } catch {
    // Silently fail — tooltip tracking shouldn't break the app
  }
}
