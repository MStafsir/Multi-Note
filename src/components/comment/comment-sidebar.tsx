// ============================================================
// MODUL 35.3: Comment Sidebar — Side panel for threaded comments
// Groups comments by thread (root + flattened replies)
// Tabs: "All" | "Open" | "Resolved"
// Resolve toggle, collapsed resolved comments expandable
// @mention autocomplete in comment input
// ============================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MessageSquare,
  CheckCircle2,
  CircleDot,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CommentThread } from './comment-thread';
import { CommentInput } from './comment-input';
import {
  useComments,
  useCreateComment,
} from '@/hooks/use-comments';
import { useCommentCollab } from '@/hooks/use-comment-collab';
import { useAuthStore } from '@/store/auth';
import type { CommentThread as CommentThreadType, AnchorPosition } from '@/types';

interface CommentSidebarProps {
  nodeId: string;
  onClose: () => void;
  onScrollToAnchor?: (anchorPosition: Record<string, unknown>) => void;
  /** Optional anchor position from selection handler — opens new comment form with anchor */
  pendingAnchorPosition?: AnchorPosition | null;
  onClearPendingAnchor?: () => void;
}

type FilterTab = 'all' | 'open' | 'resolved';

export function CommentSidebar({
  nodeId,
  onClose,
  onScrollToAnchor,
  pendingAnchorPosition,
  onClearPendingAnchor,
}: CommentSidebarProps) {
  const { user } = useAuthStore();
  const userId = user?.id || '';
  const userName = user?.name || user?.email || 'Anonymous';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<FilterTab>('open');
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());

  // Determine includeResolved based on tab
  const includeResolved = activeTab === 'all' || activeTab === 'resolved';

  // Fetch comments
  const { data: commentsData, isLoading } = useComments(nodeId, includeResolved);

  // Create comment mutation
  const createComment = useCreateComment();

  // Connect to comment collab service for realtime updates
  const commentCollab = useCommentCollab({ nodeId, userId, userName });

  // Listen for comment-created events from thread replies
  useEffect(() => {
    const handleCommentCreated = (e: CustomEvent<{ nodeId: string }>) => {
      if (e.detail.nodeId === nodeId) {
        queryClient.invalidateQueries({ queryKey: ['comments'] });
      }
    };
    window.addEventListener('comment-created', handleCommentCreated as EventListener);
    return () => window.removeEventListener('comment-created', handleCommentCreated as EventListener);
  }, [nodeId, queryClient]);

  // Filter threads based on active tab
  const threads: CommentThreadType[] = commentsData?.threads || [];

  const filteredThreads = threads.filter(thread => {
    if (activeTab === 'all') return true;
    if (activeTab === 'open') return !thread.root.resolvedAt;
    if (activeTab === 'resolved') return !!thread.root.resolvedAt;
    return true;
  });

  // Count stats
  const openCount = threads.filter(t => !t.root.resolvedAt).length;
  const resolvedCount = threads.filter(t => !!t.root.resolvedAt).length;
  const totalCount = threads.length;

  // Toggle thread collapse
  const toggleCollapse = useCallback((threadId: string) => {
    setCollapsedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  }, []);

  // Handle new comment submission
  const handleCreateComment = useCallback(async (
    content: string,
    anchorPosition?: AnchorPosition | null,
    parentCommentId?: string | null
  ) => {
    const result = await createComment.mutateAsync({
      nodeId,
      content,
      anchorPosition,
      parentCommentId,
    });

    // Broadcast to other viewers via comment collab
    commentCollab.emitCommentCreate({
      commentId: result.id,
      nodeId,
      userId,
    });

    // Clear pending anchor if present
    if (pendingAnchorPosition && onClearPendingAnchor) {
      onClearPendingAnchor();
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['comments'] });
  }, [nodeId, userId, createComment, commentCollab, pendingAnchorPosition, onClearPendingAnchor, queryClient]);

  // Scroll to anchored text in editor
  const handleScrollToAnchor = useCallback((anchorPosition: Record<string, unknown>) => {
    if (onScrollToAnchor) {
      onScrollToAnchor(anchorPosition);
    }
  }, [onScrollToAnchor]);

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 340, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="shrink-0 border-l bg-background flex flex-col h-full overflow-hidden"
      role="complementary"
      aria-label="Comments panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Comments</h3>
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 h-5">
              {totalCount}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 min-h-[44px] min-w-[44px]"
          onClick={onClose}
          aria-label="Close comments panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as FilterTab)}
        className="px-4 pt-2"
      >
        <TabsList className="w-full h-8">
          <TabsTrigger value="open" className="text-xs flex items-center gap-1 flex-1">
            <CircleDot className="h-3 w-3" />
            Open {openCount > 0 ? `(${openCount})` : ''}
          </TabsTrigger>
          <TabsTrigger value="resolved" className="text-xs flex items-center gap-1 flex-1">
            <CheckCircle2 className="h-3 w-3" />
            Resolved {resolvedCount > 0 ? `(${resolvedCount})` : ''}
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs flex-1">
            All {totalCount > 0 ? `(${totalCount})` : ''}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Separator className="mt-2" />

      {/* Thread list */}
      <ScrollArea className="flex-1 px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading comments...</span>
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {activeTab === 'resolved'
                ? 'No resolved comments yet'
                : activeTab === 'open'
                ? 'No open comments on this note'
                : 'No comments on this note yet'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Select text in the editor to add a comment
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {filteredThreads.map(thread => (
              <CommentThread
                key={thread.root.id}
                thread={thread}
                nodeId={nodeId}
                onScrollToAnchor={handleScrollToAnchor}
                isCollapsed={collapsedThreads.has(thread.root.id)}
                onToggleCollapse={() => toggleCollapse(thread.root.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <Separator />

      {/* New comment form at bottom */}
      <div className="p-4">
        {pendingAnchorPosition && (
          <div className="mb-2 p-2 rounded-md bg-muted/50 border text-xs">
            <p className="text-muted-foreground">
              Commenting on: <span className="font-medium">&quot;{pendingAnchorPosition.text}&quot;</span>
            </p>
          </div>
        )}
        <CommentInput
          nodeId={nodeId}
          userId={userId}
          onSubmit={handleCreateComment}
          anchorPosition={pendingAnchorPosition}
          isSubmitting={createComment.isPending}
        />
      </div>
    </motion.div>
  );
}
