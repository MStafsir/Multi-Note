// ============================================================
// MODUL 35.6: Comment Collab Hook — Realtime comment sync via Socket.IO
// Connects to comment-sync-service on port 3004.
// When a comment event is received, invalidates React Query cache
// so the comment sidebar auto-updates.
// ============================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

// IMPORTANT: Frontend must ALWAYS use io("/?XTransformPort=3004")
// NEVER use io("http://localhost:3004") or direct port connection
// Path MUST be "/" so Caddy can forward correctly

interface UseCommentCollabOptions {
  nodeId: string;
  userId: string;
  userName: string;
}

interface CommentEventPayload {
  commentId: string;
  nodeId: string;
  userId: string;
}

export function useCommentCollab({ nodeId, userId, userName }: UseCommentCollabOptions) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const isJoinedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

  // Connect to comment sync service via gateway
  useEffect(() => {
    if (!nodeId || !userId) return;

    const socket = io('/?XTransformPort=3004', {
      transports: ['websocket', 'polling'],
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[comment-collab] Connected to comment sync service');
      setIsConnected(true);

      if (!isJoinedRef.current) {
        socket.emit('join-note-room', { nodeId, userId, userName });
        isJoinedRef.current = true;
      }
    });

    socket.on('disconnect', () => {
      console.log('[comment-collab] Disconnected from comment sync service');
      setIsConnected(false);
    });

    socket.on('reconnect', () => {
      console.log('[comment-collab] Reconnected to comment sync service');
      setIsConnected(true);
      socket.emit('join-note-room', { nodeId, userId, userName });
    });

    // Listen for comment events from other users and invalidate React Query cache
    const handleCommentEvent = (payload: CommentEventPayload) => {
      if (payload.nodeId === nodeId && payload.userId !== userId) {
        // Invalidate comment queries to trigger refetch
        queryClient.invalidateQueries({ queryKey: ['comments'] });
      }
    };

    socket.on('comment-create', handleCommentEvent);
    socket.on('comment-update', handleCommentEvent);
    socket.on('comment-resolve', handleCommentEvent);
    socket.on('comment-delete', handleCommentEvent);

    return () => {
      if (socket.connected) {
        socket.emit('leave-note-room', { nodeId, userId });
      }
      socket.disconnect();
      socketRef.current = null;
      isJoinedRef.current = false;
      setIsConnected(false);
    };
  }, [nodeId, userId, userName, queryClient]);

  // Emit comment events (for broadcasting to other users)
  const emitCommentCreate = (payload: CommentEventPayload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('comment-create', payload);
    }
  };

  const emitCommentUpdate = (payload: CommentEventPayload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('comment-update', payload);
    }
  };

  const emitCommentResolve = (payload: CommentEventPayload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('comment-resolve', payload);
    }
  };

  const emitCommentDelete = (payload: CommentEventPayload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('comment-delete', payload);
    }
  };

  return {
    isConnected,
    emitCommentCreate,
    emitCommentUpdate,
    emitCommentResolve,
    emitCommentDelete,
  };
}
