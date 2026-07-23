'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// IMPORTANT: Frontend must ALWAYS use io("/?XTransformPort=3003")
// NEVER use io("http://localhost:3003") or direct port connection
// Path MUST be "/" so Caddy can forward correctly

interface CollabUser {
  userId: string;
  userName: string;
}

interface UseNoteCollabReturn {
  connectedUsers: CollabUser[];
  latestContent: string | null;
  isConnected: boolean;
  emitUpdate: (contentJson: string) => void;
}

export function useNoteCollab(
  nodeId: string,
  userId: string,
  userName: string
): UseNoteCollabReturn {
  const [connectedUsers, setConnectedUsers] = useState<CollabUser[]>([]);
  const [latestContent, setLatestContent] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const isJoinedRef = useRef(false);

  // Connect to collab service via gateway
  useEffect(() => {
    if (!nodeId || !userId) return;

    const socket = io('/?XTransformPort=3003', {
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
      console.log('[collab-hook] Connected to collab service');
      setIsConnected(true);

      // Join the note room upon connection
      if (!isJoinedRef.current) {
        socket.emit('join-note', { nodeId, userId, userName });
        isJoinedRef.current = true;
      }
    });

    socket.on('disconnect', () => {
      console.log('[collab-hook] Disconnected from collab service');
      setIsConnected(false);
    });

    socket.on('reconnect', () => {
      console.log('[collab-hook] Reconnected to collab service');
      setIsConnected(true);
      // Re-join room on reconnect
      socket.emit('join-note', { nodeId, userId, userName });
    });

    // Listen for presence updates
    socket.on('presence-update', (payload: { nodeId: string; users: CollabUser[] }) => {
      // Filter out ourselves from the connected users list
      const otherUsers = payload.users.filter((u) => u.userId !== userId);
      setConnectedUsers(otherUsers);
    });

    // Listen for note content updates from others
    socket.on('note-update', (payload: { nodeId: string; contentJson: string; userId: string }) => {
      if (payload.nodeId === nodeId && payload.userId !== userId) {
        setLatestContent(payload.contentJson);
      }
    });

    return () => {
      // Leave room and disconnect on unmount
      if (socket.connected) {
        socket.emit('leave-note', { nodeId, userId });
      }
      socket.disconnect();
      socketRef.current = null;
      isJoinedRef.current = false;
      setConnectedUsers([]);
      setLatestContent(null);
      setIsConnected(false);
    };
  }, [nodeId, userId, userName]);

  // Emit content update to other users in the room
  const emitUpdate = useCallback((contentJson: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('note-update', {
        nodeId,
        contentJson,
        userId,
      });
    }
  }, [nodeId, userId]);

  return {
    connectedUsers,
    latestContent,
    isConnected,
    emitUpdate,
  };
}
