'use client';

// ============================================================
// MODUL 18.5: Bulk Progress Bar — Progress indicator for bulk ops
// Shows: "Processing X of Y items..."
// For operations > 20 items
// ============================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface BulkProgressBarProps {
  current: number;
  total: number;
  operationName?: string;
}

export function BulkProgressBar({
  current,
  total,
  operationName = 'Processing',
}: BulkProgressBarProps) {
  // Simulated progress for UX — real progress would come from backend polling
  // Since the backend does batch operations (updateMany), we simulate incremental progress
  const [displayedProgress, setDisplayedProgress] = useState(current);
  const percentage = total > 0 ? Math.round((displayedProgress / total) * 100) : 0;

  // Smoothly animate progress over time (simulated)
  useEffect(() => {
    if (current < total) {
      // Simulate incremental progress — each tick advances by ~1 item
      const interval = setInterval(() => {
        setDisplayedProgress(prev => {
          if (prev >= total) {
            clearInterval(interval);
            return total;
          }
          return prev + 1;
        });
      }, 200); // 200ms per item

      return () => clearInterval(interval);
    }
  }, [current, total]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-3 shrink-0"
      >
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {operationName} {displayedProgress} of {total} items...
          </span>
          <Progress value={percentage} className="h-1.5" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
