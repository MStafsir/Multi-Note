'use client';

// ============================================================
// MODUL 18.6: Bulk Result Summary — Partial failure handling display
// Shows: "48 succeeded, 2 failed" with expandable failure details
// Failed items listed with reason
// Toast notification with summary
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export interface BulkResultItem {
  id: string;
  name: string;
  status: 'success' | 'failed';
  reason?: string;
}

interface BulkResultSummaryProps {
  items: BulkResultItem[];
  totalCount: number;
  onDismiss: () => void;
}

export function BulkResultSummary({
  items,
  totalCount,
  onDismiss,
}: BulkResultSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  const successCount = items.filter(i => i.status === 'success').length;
  const failedCount = items.filter(i => i.status === 'failed').length;
  const failedItems = items.filter(i => i.status === 'failed');
  const allSuccess = failedCount === 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border shadow-lg p-4
          ${allSuccess ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-neutral-900 border-border'}
        `}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`shrink-0 ${allSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500'}`}>
            {allSuccess ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold">
                Bulk Operation Complete
              </span>
            </div>

            {/* Summary stats */}
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs">
                {successCount} succeeded
              </Badge>
              {failedCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {failedCount} failed
                </Badge>
              )}
            </div>

            {/* Expandable failure details */}
            {failedCount > 0 && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {expanded ? 'Hide details' : 'Show failures'}
                </Button>

                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Separator className="my-2" />
                      <ScrollArea className="max-h-48">
                        <ul className="space-y-1.5">
                          {failedItems.map(item => (
                            <li
                              key={item.id}
                              className="flex items-start gap-2 text-sm"
                            >
                              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <span className="font-medium truncate block">{item.name}</span>
                                {item.reason && (
                                  <span className="text-xs text-muted-foreground block truncate">
                                    {item.reason}
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Dismiss button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
