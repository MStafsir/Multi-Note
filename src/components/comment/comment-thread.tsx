// ============================================================
// MODUL 35.3: Comment Thread — Single thread view
// Root comment + flattened replies (max 1 level nesting)
// Resolve/unresolve toggle, author avatar, anchor highlight button
// ============================================================

'use client';

import { useState, useCallback } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  CircleDot,
  MessageSquare,
  Crosshair,
  Trash2,
  Pencil,
} from 'lucide-react';
import { CommentInput } from './comment-input';
import { useResolveComment, useDeleteComment, useUpdateComment } from '@/hooks/use-comments';
import { useAuthStore } from '@/store/auth';
import type { CommentInfo, CommentThread as CommentThreadType } from '@/types';

interface CommentThreadProps {
  thread: CommentThreadType;
  nodeId: string;
  onScrollToAnchor?: (anchorPosition: Record<string, unknown>) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function CommentThread({
  thread,
  nodeId,
  onScrollToAnchor,
  isCollapsed = false,
  onToggleCollapse,
}: CommentThreadProps) {
  const { user } = useAuthStore();
  const userId = user?.id || '';
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const resolveMutation = useResolveComment();
  const deleteMutation = useDeleteComment();
  const updateMutation = useUpdateComment();

  const isResolved = !!thread.root.resolvedAt;

  // Resolve/unresolve the root comment (toggles the whole thread)
  const handleResolveToggle = useCallback(() => {
    resolveMutation.mutate({
      commentId: thread.root.id,
      resolved: !isResolved,
      nodeId,
    });
  }, [thread.root.id, isResolved, nodeId, resolveMutation]);

  // Delete a comment
  const handleDelete = useCallback((commentId: string) => {
    deleteMutation.mutate({ commentId, nodeId });
  }, [nodeId, deleteMutation]);

  // Start editing a comment
  const handleStartEdit = useCallback((comment: CommentInfo) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  }, []);

  // Save edited content
  const handleSaveEdit = useCallback(async () => {
    if (!editingCommentId || !editContent.trim()) return;
    updateMutation.mutate({
      commentId: editingCommentId,
      content: editContent.trim(),
      nodeId,
    }, {
      onSuccess: () => {
        setEditingCommentId(null);
        setEditContent('');
      },
    });
  }, [editingCommentId, editContent, nodeId, updateMutation]);

  // Format timestamp
  const formatTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  };

  const rootComment = thread.root;
  const replies = thread.replies;

  // Check if user is the author of a comment
  const isAuthor = (comment: CommentInfo) => comment.authorId === userId;

  // Render a single comment
  const renderComment = (comment: CommentInfo, isRoot: boolean) => {
    const isEditing = editingCommentId === comment.id;
    const displayName = comment.authorName || comment.authorEmail?.split('@')[0] || 'Unknown';
    const initials = displayName.charAt(0).toUpperCase();

    return (
      <div key={comment.id} className="flex gap-2.5 py-2">
        {/* Avatar */}
        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
          <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{displayName}</span>
            <span className="text-xs text-muted-foreground">{formatTime(comment.createdAt)}</span>
            {isRoot && isResolved && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                <CheckCircle2 className="h-3 w-3 mr-0.5 text-emerald-600" />
                Resolved
              </Badge>
            )}
          </div>

          {isEditing ? (
            <div className="mt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[40px] text-sm border rounded-md p-2 resize-y bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                maxLength={2000}
                autoFocus
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                  if (e.key === 'Escape') {
                    setEditingCommentId(null);
                  }
                }}
              />
              <div className="flex items-center gap-2 mt-1">
                <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending} className="text-xs">
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingCommentId(null)} className="text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm mt-0.5 break-words whitespace-pre-wrap">
              {comment.content}
            </p>
          )}

          {/* Action buttons */}
          {!isEditing && (
            <div className="flex items-center gap-1 mt-1">
              {isRoot && !isResolved && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleResolveToggle}
                  disabled={resolveMutation.isPending}
                  aria-label="Resolve comment"
                >
                  <CheckCircle2 className="h-3 w-3 mr-0.5" />
                  Resolve
                </Button>
              )}
              {isRoot && isResolved && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleResolveToggle}
                  disabled={resolveMutation.isPending}
                  aria-label="Unresolve comment"
                >
                  <CircleDot className="h-3 w-3 mr-0.5" />
                  Reopen
                </Button>
              )}
              {isRoot && comment.anchorPosition && onScrollToAnchor && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onScrollToAnchor(comment.anchorPosition as Record<string, unknown>)}
                  aria-label="Scroll to anchored text"
                >
                  <Crosshair className="h-3 w-3 mr-0.5" />
                  Show in note
                </Button>
              )}
              {isAuthor(comment) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleStartEdit(comment)}
                  aria-label="Edit comment"
                >
                  <Pencil className="h-3 w-3 mr-0.5" />
                  Edit
                </Button>
              )}
              {(isAuthor(comment) || isNodeOwner()) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(comment.id)}
                  disabled={deleteMutation.isPending}
                  aria-label="Delete comment"
                >
                  <Trash2 className="h-3 w-3 mr-0.5" />
                  Delete
                </Button>
              )}
              {isRoot && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowReplyInput(!showReplyInput)}
                  aria-label="Reply to thread"
                >
                  <MessageSquare className="h-3 w-3 mr-0.5" />
                  Reply
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Check if current user is the node owner (for delete permissions)
  const isNodeOwner = () => {
    // Simplified check — could be enhanced with node data
    return false; // In practice, this would check node.ownerId === userId
  };

  return (
    <div className={`group border rounded-lg bg-background p-4 ${isResolved ? 'opacity-70' : ''}`}>
      {/* Root comment */}
      {renderComment(rootComment, true)}

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-9 mt-1">
          <Separator className="my-2" />
          {replies.map(reply => renderComment(reply, false))}
        </div>
      )}

      {/* Reply input */}
      {showReplyInput && (
        <div className="ml-9 mt-2">
          <CommentInput
            nodeId={nodeId}
            userId={userId}
            isReply
            parentCommentId={thread.root.id}
            onSubmit={async (content, anchorPos, parentId) => {
              // Use createComment mutation (handled by parent sidebar)
              // For now, just emit the event
              const res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  nodeId,
                  content,
                  parentCommentId: parentId,
                  anchorPosition: null, // Replies don't have anchor positions
                }),
              });
              const data = await res.json();
              if (!data.success) throw new Error(data.error);
              setShowReplyInput(false);
              // Invalidate queries
              window.dispatchEvent(new CustomEvent('comment-created', { detail: { nodeId } }));
            }}
            onCancel={() => setShowReplyInput(false)}
            isSubmitting={false}
          />
        </div>
      )}

      {/* Collapse/expand for resolved threads */}
      {isResolved && replies.length > 0 && onToggleCollapse && (
        <div className="ml-9 mt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={onToggleCollapse}
          >
            {isCollapsed ? `Show ${replies.length} replies` : 'Hide replies'}
          </Button>
        </div>
      )}
    </div>
  );
}
