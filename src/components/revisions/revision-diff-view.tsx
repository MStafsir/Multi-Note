'use client';

// ============================================================
// MODUL 16.3: Revision Diff View — Rendering Component
// Shows color-coded diff between note revisions
// Green (add), Red (remove), Neutral (unchanged)
// Paragraph-level and word-level granularity
// ============================================================

import { motion } from 'framer-motion';
import type { DiffLine, DiffData } from '@/types';

interface RevisionDiffViewProps {
  diffData: DiffData;
  className?: string;
}

export function RevisionDiffView({ diffData, className }: RevisionDiffViewProps) {
  const lines = diffData.diff || [];

  // Compute stats
  const addedCount = lines.filter(l => l.type === 'add').length;
  const removedCount = lines.filter(l => l.type === 'remove').length;
  const sameCount = lines.filter(l => l.type === 'same').length;

  return (
    <div className={className}>
      {/* Stats bar */}
      {lines.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-sm">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            +{addedCount} added
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            -{removedCount} removed
          </span>
          <span className="text-muted-foreground">
            {sameCount} unchanged
          </span>
        </div>
      )}

      {/* Diff lines */}
      {lines.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No differences found</p>
        </div>
      ) : (
        <div className="space-y-0 font-mono text-sm overflow-x-auto">
          {lines.map((line, index) => (
            <motion.div
              key={`diff-line-${index}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.1, delay: Math.min(index * 0.01, 0.5) }}
              className={`flex items-start py-1 px-3 rounded-sm
                ${line.type === 'add' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-l-3 border-emerald-400 dark:border-emerald-600' : ''}
                ${line.type === 'remove' ? 'bg-red-50 dark:bg-red-950/20 border-l-3 border-red-400 dark:border-red-600' : ''}
                ${line.type === 'same' ? '' : ''}
              `}
            >
              {/* Type indicator */}
              <span className={`shrink-0 w-5 text-right font-bold select-none
                ${line.type === 'add' ? 'text-emerald-600 dark:text-emerald-400' : ''}
                ${line.type === 'remove' ? 'text-red-600 dark:text-red-400' : ''}
                ${line.type === 'same' ? 'text-muted-foreground' : ''}
              `}>
                {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ''}
              </span>

              {/* Content */}
              <span className={`flex-1 min-w-0 whitespace-pre-wrap break-words
                ${line.type === 'add' ? 'text-emerald-700 dark:text-emerald-300' : ''}
                ${line.type === 'remove' ? 'text-red-700 dark:text-red-300 line-through opacity-70' : ''}
                ${line.type === 'same' ? 'text-foreground' : ''}
              `}>
                {line.content || ' '}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
