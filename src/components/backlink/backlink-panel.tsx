// ============================================================
// MODUL 34.3: Backlink Panel — Collapsible section below note editor
// Shows all notes that reference the current note (backlinks)
// Includes: source note name, context snippet, timestamp
// Broken links: strikethrough + gray + "Deleted" badge
// Click on backlink card navigates to source note
// Expand/collapse animation (framer-motion)
// ============================================================

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, FileText, AlertTriangle, Clock, Link2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useBacklinks } from '@/hooks/use-backlinks';
import type { BacklinkInfo } from '@/types';

interface BacklinkPanelProps {
  nodeId: string;
  onNavigateToNote?: (noteId: string, noteName: string) => void;
}

export function BacklinkPanel({ nodeId, onNavigateToNote }: BacklinkPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { data, isLoading, error } = useBacklinks(nodeId);

  const backlinks = data?.backlinks || [];
  const total = data?.total || 0;

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-background p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        {isExpanded && (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-16 w-full rounded" />
            <Skeleton className="h-16 w-full rounded" />
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return null; // Silently fail — backlinks are supplementary info
  }

  if (total === 0) {
    return (
      <div className="border rounded-lg bg-background p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Link2 className="h-4 w-4" />
          <span className="text-sm font-medium">No backlinks</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          No other notes reference this note yet
        </p>
      </div>
    );
  }

  const handleClick = (backlink: BacklinkInfo & { accessRevoked?: boolean }) => {
    if (backlink.isBroken || backlink.accessRevoked) return;
    if (onNavigateToNote) {
      onNavigateToNote(backlink.sourceNodeId, backlink.sourceNodeName);
    } else {
      // Dispatch custom event for workspace layout to handle
      const event = new CustomEvent('note-link-click', {
        detail: {
          noteId: backlink.sourceNodeId,
          noteName: backlink.sourceNodeName,
        },
        bubbles: true,
      });
      document.dispatchEvent(event);
    }
  };

  return (
    <div className="border rounded-lg bg-background">
      {/* Header — clickable to expand/collapse */}
      <button
        className="flex items-center justify-between w-full p-4 text-left hover:bg-accent/10 transition-colors rounded-lg"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={`Backlinks (${total}) — click to ${isExpanded ? 'collapse' : 'expand'}`}
      >
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold">
            Backlinks
          </span>
          <Badge variant="secondary" className="text-xs">
            {total}
          </Badge>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 0 : -90 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <Separator />
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
              {backlinks.map((backlink, index) => (
                <BacklinkCard
                  key={backlink.sourceNodeId + '-' + index}
                  backlink={backlink as BacklinkInfo & { accessRevoked?: boolean }}
                  onClick={() => handleClick(backlink as BacklinkInfo & { accessRevoked?: boolean })}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Individual Backlink Card
// ============================================================

interface BacklinkCardProps {
  backlink: BacklinkInfo & { accessRevoked?: boolean };
  onClick: () => void;
}

function BacklinkCard({ backlink, onClick }: BacklinkCardProps) {
  const isBroken = backlink.isBroken;
  const isRevoked = backlink.accessRevoked;
  const isDisabled = isBroken || isRevoked;

  return (
    <Card
      className={`transition-all ${
        isDisabled
          ? 'opacity-60 cursor-not-allowed border-gray-300 dark:border-gray-600'
          : 'cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-sm'
      }`}
      onClick={isDisabled ? undefined : onClick}
      role={isDisabled ? 'article' : 'link'}
      tabIndex={isDisabled ? -1 : 0}
      aria-label={
        isBroken
          ? `Broken link from deleted note: ${backlink.sourceNodeName}`
          : isRevoked
            ? `No access to source note: ${backlink.sourceNodeName}`
            : `Backlink from: ${backlink.sourceNodeName}`
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isDisabled) {
          onClick();
        }
      }}
    >
      <CardContent className="p-3">
        {/* Source note name */}
        <div className="flex items-center gap-2 mb-1">
          <FileText
            className={`h-3.5 w-3.5 shrink-0 ${
              isBroken ? 'text-gray-400' : 'text-emerald-600'
            }`}
          />
          <span
            className={`text-sm font-medium truncate ${
              isBroken ? 'line-through text-gray-400 dark:text-gray-500' : 'text-foreground'
            }`}
          >
            {backlink.sourceNodeName}
          </span>

          {/* Status badges */}
          {isBroken && (
            <Badge variant="destructive" className="text-xs shrink-0">
              Deleted
            </Badge>
          )}
          {isRevoked && (
            <Badge variant="outline" className="text-xs shrink-0 text-orange-500 border-orange-300">
              No access
            </Badge>
          )}
        </div>

        {/* Context snippet */}
        <p
          className={`text-xs ${
            isBroken ? 'text-gray-400 dark:text-gray-500' : 'text-muted-foreground'
          } line-clamp-2`}
        >
          {isBroken ? (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              This note has been deleted — link is broken
            </span>
          ) : isRevoked ? (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              You don&apos;t have access to view this note&apos;s content
            </span>
          ) : (
            backlink.contextSnippet || 'References this note'
          )}
        </p>

        {/* Timestamp */}
        {!isDisabled && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {new Date(backlink.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
