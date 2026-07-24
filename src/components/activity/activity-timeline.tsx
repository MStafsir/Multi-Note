'use client';

// ============================================================
// MODUL 19: Activity Timeline — Timeline display component
// Shows activity entries in chronological order (newest first)
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Pencil,
  ArrowRight,
  Trash2,
  RotateCcw,
  Share2,
  Eye,
  ChevronDown,
  ChevronRight,
  Loader2,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useActivityLog, useNodeActivity, type ActivityEntry } from '@/hooks/use-activity';

interface ActivityTimelineProps {
  nodeId?: string;
  className?: string;
}

// Map actionType to icon component
function getActionIcon(actionType: string) {
  switch (actionType) {
    case 'create':
      return <Plus className="h-4 w-4 text-emerald-500" />;
    case 'rename':
      return <Pencil className="h-4 w-4 text-blue-500" />;
    case 'move':
      return <ArrowRight className="h-4 w-4 text-orange-500" />;
    case 'delete':
      return <Trash2 className="h-4 w-4 text-red-500" />;
    case 'restore':
      return <RotateCcw className="h-4 w-4 text-amber-500" />;
    case 'share':
      return <Share2 className="h-4 w-4 text-purple-500" />;
    case 'edit':
      return <Pencil className="h-4 w-4 text-blue-500" />;
    default:
      return <Eye className="h-4 w-4 text-muted-foreground" />;
  }
}

// Generate human-readable description from actionType + metadata
function buildDescription(entry: ActivityEntry): string {
  const actor = entry.actorName || entry.actorEmail || 'Unknown user';
  const meta = entry.metadata || {};
  const nodeName = entry.nodeName || 'item';

  switch (entry.actionType) {
    case 'create':
      return `${actor} created "${nodeName}"`;
    case 'rename':
      return `${actor} renamed "${meta.oldName || nodeName}" to "${meta.newName || nodeName}"`;
    case 'move':
      return `${actor} moved "${nodeName}"`;
    case 'delete':
      return `${actor} deleted "${nodeName}"`;
    case 'restore':
      return `${actor} restored "${nodeName}"`;
    case 'share':
      return `${actor} shared "${nodeName}"`;
    case 'edit':
      return `${actor} edited "${nodeName}"`;
    default:
      return `${actor} performed ${entry.actionType} on "${nodeName}"`;
  }
}

function ActivityEntryItem({ entry }: { entry: ActivityEntry }) {
  const [expanded, setExpanded] = useState(false);

  const timestamp = formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true });

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      {/* Timeline dot + line */}
      <div className="flex items-start gap-3 pb-4">
        {/* Icon dot */}
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0 mt-0.5">
          {getActionIcon(entry.actionType)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug">
            {buildDescription(entry)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{timestamp}</span>
            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Details
              </Button>
            )}
          </div>

          {/* Expandable metadata */}
          <AnimatePresence>
            {expanded && entry.metadata && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="mt-2 p-2 bg-muted/50 rounded-md text-xs overflow-hidden"
              >
                <pre className="whitespace-pre-wrap break-words text-muted-foreground">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

export function ActivityTimeline({ nodeId, className }: ActivityTimelineProps) {
  // Always call both hooks (rules of hooks) — select which result to use
  const allActivity = useActivityLog();
  const nodeActivity = useNodeActivity(nodeId ?? '');

  // Use node-specific data when nodeId is provided, otherwise all user activity
  const activityQuery = nodeId ? nodeActivity : allActivity;

  const entries = activityQuery.data?.entries || [];
  const total = activityQuery.data?.total || 0;
  const isLoading = activityQuery.isLoading;

  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={className}>
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted mb-3">
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No activity yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <ScrollArea className="max-h-64">
        <div className="space-y-0.5 pr-2">
          {entries.map((entry) => (
            <ActivityEntryItem key={entry.id} entry={entry} />
          ))}
        </div>
      </ScrollArea>

      {/* Load more indicator */}
      {entries.length < total && (
        <div className="mt-2 pt-2">
          <Separator />
          <p className="text-xs text-muted-foreground text-center mt-2">
            Showing {entries.length} of {total} entries
          </p>
        </div>
      )}
    </div>
  );
}
