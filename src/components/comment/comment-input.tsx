// ============================================================
// MODUL 35.5: Comment Input — Form for new comment/reply
// Plain text input (max 2000 chars) with @mention autocomplete
// Users with access to node (node_shares + owner) appear in dropdown
// ============================================================

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { useNodeAccessibleUsers } from '@/hooks/use-comments';
import type { AnchorPosition } from '@/types';

interface CommentInputProps {
  nodeId: string;
  userId: string;
  onSubmit: (content: string, anchorPosition?: AnchorPosition | null, parentCommentId?: string | null) => Promise<void>;
  onCancel?: () => void;
  parentCommentId?: string | null;
  anchorPosition?: AnchorPosition | null;
  isReply?: boolean;
  isSubmitting?: boolean;
}

interface MentionUser {
  id: string;
  name: string | null;
  email: string | null;
}

export function CommentInput({
  nodeId,
  userId,
  onSubmit,
  onCancel,
  parentCommentId,
  anchorPosition,
  isReply = false,
  isSubmitting = false,
}: CommentInputProps) {
  const [content, setContent] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);

  // Fetch users with access to this node for @mention autocomplete
  const { data: accessibleUsers } = useNodeAccessibleUsers(nodeId);

  // Filter users based on mention query
  const filteredUsers: MentionUser[] = (accessibleUsers || [])
    .filter(u => u.id !== userId) // Don't show self
    .filter(u => {
      if (!mentionQuery) return true;
      const query = mentionQuery.toLowerCase();
      return (
        (u.name && u.name.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query))
      );
    });

  // Detect @mention trigger
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);

    // Check if user is typing a @mention
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1 && (lastAtIndex === 0 || textBeforeCursor[lastAtIndex - 1] === ' ' || textBeforeCursor[lastAtIndex - 1] === '\n')) {
      // There's an @ trigger; extract the query after it
      const queryAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Only open mention if there's no space after the @ (i.e., still typing the name)
      if (!queryAfterAt.includes(' ') && queryAfterAt.length <= 30) {
        setMentionOpen(true);
        setMentionQuery(queryAfterAt);
        setMentionIndex(0);
      } else {
        setMentionOpen(false);
      }
    } else {
      setMentionOpen(false);
    }
  }, []);

  // Insert @mention selection
  const insertMention = useCallback((user: MentionUser) => {
    const displayName = user.name || user.email?.split('@')[0] || user.id;
    const mentionText = `@${displayName} `;

    const cursorPos = textareaRef.current?.selectionStart ?? content.length;
    const textBeforeCursor = content.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const textBeforeAt = content.slice(0, lastAtIndex);
    const textAfterCursor = content.slice(cursorPos);

    const newContent = textBeforeAt + mentionText + textAfterCursor;
    setContent(newContent);
    setMentionOpen(false);

    // Set cursor position after the mention
    const newCursorPos = textBeforeAt.length + mentionText.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [content]);

  // Submit comment
  const handleSubmit = useCallback(async () => {
    if (!content.trim() || isSubmitting) return;
    try {
      await onSubmit(content.trim(), anchorPosition, parentCommentId);
      setContent('');
    } catch {
      // Error handled by mutation hook
    }
  }, [content, isSubmitting, onSubmit, anchorPosition, parentCommentId]);

  // Handle keyboard navigation in mention dropdown
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionOpen || filteredUsers.length === 0) {
      // Submit on Ctrl+Enter or Cmd+Enter
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && content.trim()) {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex(prev => Math.min(prev + 1, filteredUsers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filteredUsers[mentionIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMentionOpen(false);
    }
  }, [mentionOpen, filteredUsers, mentionIndex, insertMention, content, handleSubmit]);

  // Scroll mention dropdown item into view
  useEffect(() => {
    if (mentionOpen && mentionRef.current) {
      const selectedItem = mentionRef.current.querySelector(`[data-index="${mentionIndex}"]`);
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [mentionIndex, mentionOpen]);

  return (
    <div className="relative">
      {/* @mention autocomplete dropdown */}
      {mentionOpen && filteredUsers.length > 0 && (
        <div
          ref={mentionRef}
          className="absolute bottom-full left-0 z-50 mb-1 w-56 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          <div className="p-1">
            {filteredUsers.map((user, idx) => (
              <button
                key={user.id}
                data-index={idx}
                className={`flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                  idx === mentionIndex ? 'bg-accent' : ''
                }`}
                onClick={() => insertMention(user)}
                onMouseEnter={() => setMentionIndex(idx)}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-xs">
                    {(user.name || user.email || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate font-medium">
                  {user.name || user.email?.split('@')[0] || 'Unknown'}
                </span>
                {user.email && (
                  <span className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
        placeholder={isReply ? 'Reply to this thread... (type @ to mention)' : 'Add a comment... (type @ to mention someone)'}
        className="min-h-[80px] max-h-[200px] resize-y text-sm"
        maxLength={2000}
        disabled={isSubmitting}
        aria-label={isReply ? 'Reply input' : 'New comment input'}
      />

      {/* Character count + action buttons */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">
          {content.length}/{2000}
        </span>

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            className="text-xs"
          >
            {isSubmitting ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            {isReply ? 'Reply' : 'Comment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
