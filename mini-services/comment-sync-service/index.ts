// ============================================================
// MODUL 35.6: Comment Sync Service — Realtime Socket.IO
// Provides comment-update broadcasting alongside note collab.
// Port 3004 (separate from collab-service on 3003).
//
// Events:
//   join-note-room   — join a note's comment room
//   leave-note-room  — leave a note's comment room
//   comment-create   — broadcast new comment to room
//   comment-update   — broadcast comment content change to room
//   comment-resolve  — broadcast resolve/unresolve to room
//   comment-delete   — broadcast comment deletion to room
// ============================================================

import { createServer } from 'http';
import { Server, Socket } from 'socket.io';

const httpServer = createServer();
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

interface CommentPayload {
  commentId: string;
  nodeId: string;
  userId: string;
  comment?: Record<string, unknown>;
}

// Track which rooms each socket is in
const socketRooms = new Map<string, Set<string>>();

io.on('connection', (socket: Socket) => {
  console.log(`[comment-sync] Connected: ${socket.id}`);

  // ---- join-note-room ----
  socket.on('join-note-room', (payload: { nodeId: string; userId: string; userName: string }) => {
    const roomKey = `comment:${payload.nodeId}`;
    socket.join(roomKey);

    if (!socketRooms.has(socket.id)) {
      socketRooms.set(socket.id, new Set());
    }
    socketRooms.get(socket.id)!.add(payload.nodeId);

    console.log(`[comment-sync] ${payload.userName} joined comment:${payload.nodeId}`);
  });

  // ---- leave-note-room ----
  socket.on('leave-note-room', (payload: { nodeId: string; userId: string }) => {
    const roomKey = `comment:${payload.nodeId}`;
    socket.leave(roomKey);

    const rooms = socketRooms.get(socket.id);
    if (rooms) {
      rooms.delete(payload.nodeId);
    }

    console.log(`[comment-sync] User left comment:${payload.nodeId}`);
  });

  // ---- comment-create ----
  socket.on('comment-create', (payload: CommentPayload) => {
    const roomKey = `comment:${payload.nodeId}`;
    // Broadcast to all OTHER users in the room
    socket.to(roomKey).emit('comment-create', payload);
  });

  // ---- comment-update ----
  socket.on('comment-update', (payload: CommentPayload) => {
    const roomKey = `comment:${payload.nodeId}`;
    socket.to(roomKey).emit('comment-update', payload);
  });

  // ---- comment-resolve ----
  socket.on('comment-resolve', (payload: CommentPayload) => {
    const roomKey = `comment:${payload.nodeId}`;
    socket.to(roomKey).emit('comment-resolve', payload);
  });

  // ---- comment-delete ----
  socket.on('comment-delete', (payload: CommentPayload) => {
    const roomKey = `comment:${payload.nodeId}`;
    socket.to(roomKey).emit('comment-delete', payload);
  });

  // ---- disconnect ----
  socket.on('disconnect', () => {
    console.log(`[comment-sync] Disconnected: ${socket.id}`);
    socketRooms.delete(socket.id);
  });

  socket.on('error', (error: Error) => {
    console.error(`[comment-sync] Socket error (${socket.id}):`, error);
  });
});

// Start on port 3004
const PORT = 3004;
httpServer.listen(PORT, () => {
  console.log(`[comment-sync] Comment realtime sync service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[comment-sync] Received SIGTERM, shutting down...');
  httpServer.close(() => {
    console.log('[comment-sync] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[comment-sync] Received SIGINT, shutting down...');
  httpServer.close(() => {
    console.log('[comment-sync] Server closed');
    process.exit(0);
  });
});
