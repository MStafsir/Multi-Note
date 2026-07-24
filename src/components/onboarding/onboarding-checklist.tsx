'use client';

// ============================================================
// MODUL 39.5: Onboarding Checklist Widget
// Dismissible progress tracker showing feature adoption steps
// Appears as floating widget in bottom-right
// Each step completion triggers POST to /api/onboarding
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileText,
  Calculator,
  Command,
  FolderPlus,
  Search,
  Share2,
  X,
  CheckCircle2,
  Circle,
  PartyPopper,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthStore } from '@/store/auth';

interface OnboardingChecklistProps {
  onDismiss?: () => void;
  onStepComplete?: (stepName: string) => void;
}

// Checklist step definitions
const CHECKLIST_STEPS = [
  { key: 'upload_file', label: 'Upload a file', icon: Upload },
  { key: 'create_note', label: 'Create a note', icon: FileText },
  { key: 'use_calculator', label: 'Use the calculator', icon: Calculator },
  { key: 'use_command_palette', label: 'Use command palette (Ctrl+K)', icon: Command },
  { key: 'create_folder', label: 'Create a folder', icon: FolderPlus },
  { key: 'use_search', label: 'Use search', icon: Search },
  { key: 'share_item', label: 'Share an item', icon: Share2 },
];

type ChecklistProgress = Record<string, boolean>;

export function OnboardingChecklist({ onDismiss, onStepComplete }: OnboardingChecklistProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Fetch onboarding state
  const { data: onboardingData, isLoading } = useQuery({
    queryKey: ['onboarding'],
    queryFn: async () => {
      const res = await fetch('/api/onboarding');
      const data = await res.json();
      return data.data as {
        welcomeCompleted: boolean;
        sampleContentLoaded: boolean;
        checklistProgress: ChecklistProgress;
        dismissedAt: string | null;
        steps: string[];
      };
    },
    enabled: !!user,
  });

  // Mutation to mark a step as completed
  const stepMutation = useMutation({
    mutationFn: async (stepKey: string) => {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistStep: stepKey }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  // Mutation to dismiss onboarding
  const dismissMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss: true }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      onDismiss?.();
    },
  });

  const progress = onboardingData?.checklistProgress || {};
  const completedCount = CHECKLIST_STEPS.filter(s => progress[s.key]).length;
  const totalCount = CHECKLIST_STEPS.length;
  const progressPercent = (completedCount / totalCount) * 100;
  const allCompleted = completedCount === totalCount;
  const isDismissed = !!onboardingData?.dismissedAt;

  // Auto-dismiss after all completed (with delay)
  useEffect(() => {
    if (allCompleted && !isDismissed) {
      const timer = setTimeout(() => {
        dismissMutation.mutate();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [allCompleted, isDismissed, dismissMutation]);

  const handleDismiss = useCallback(() => {
    dismissMutation.mutate();
  }, [dismissMutation]);

  // If dismissed or loading, don't show
  if (isDismissed || isLoading) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-4 right-4 z-40 w-72 rounded-xl border border-border bg-background shadow-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-2">
            {!allCompleted ? (
              <span className="text-sm font-medium">Getting Started</span>
            ) : (
              <span className="text-sm font-medium flex items-center gap-1">
                <PartyPopper className="h-4 w-4 text-yellow-500" />
                You&apos;re all set!
              </span>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {completedCount}/{totalCount}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 min-h-[44px] min-w-[44px]"
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? 'Expand checklist' : 'Collapse checklist'}
            >
              <motion.div
                animate={{ rotate: isCollapsed ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <X className="h-3.5 w-3.5" />
              </motion.div>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
              aria-label="Dismiss onboarding checklist"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-1">
          <Progress value={progressPercent} className="h-1.5" />
        </div>

        {/* Steps list */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ScrollArea className="max-h-48">
                <ul className="px-4 py-2 space-y-2" role="list" aria-label="Onboarding checklist">
                  {CHECKLIST_STEPS.map((step) => {
                    const isCompleted = !!progress[step.key];
                    return (
                      <motion.li
                        key={step.key}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.05 }}
                        className="flex items-center gap-3 min-h-[44px]"
                        role="listitem"
                      >
                        <div className={`flex items-center justify-center w-5 h-5 shrink-0 ${
                          isCompleted ? 'text-emerald-500' : 'text-muted-foreground/40'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </div>
                        <step.icon className={`h-4 w-4 shrink-0 ${
                          isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/60'
                        }`} />
                        <span className={`text-sm flex-1 min-w-0 ${
                          isCompleted ? 'text-muted-foreground' : 'text-foreground'
                        }`}>
                          {step.label}
                        </span>
                      </motion.li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* All completed message */}
        {allCompleted && !isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 py-3 text-center"
          >
            <p className="text-sm text-muted-foreground">
              Auto-dismissing in a moment...
            </p>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// Export checklist steps and progress update function for use by other components
export { CHECKLIST_STEPS };

/**
 * Call this from other components to mark an onboarding step as completed.
 * Usage: markOnboardingStep('upload_file')
 */
export async function markOnboardingStep(stepKey: string): Promise<void> {
  try {
    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklistStep: stepKey }),
    });
  } catch {
    // Silently fail — onboarding tracking shouldn't break the app
  }
}
