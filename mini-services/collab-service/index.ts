import { createServer } from 'http';
import { Server, Socket } from 'socket.io';

const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses this to forward requests
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ============================================================
// Presence tracking: nodeId → Set of connected users
// ============================================================

interface RoomUser {
  userId: string;
  userName: string;
  socketId: string;
}

// Map of nodeId → Map of socketId → RoomUser
const rooms = new Map<string, Map<string, RoomUser>>();

function getRoomUsers(nodeId: string): Array<{ userId: string; userName: string }> {
  const room = rooms.get(nodeId);
  if (!room) return [];
  // Deduplicate by userId (same user might have multiple sockets/tabs)
  const seen = new Set<string>();
  const result: Array<{ userId: string; userName: string }> = [];
  for (const user of room.values()) {
    if (!seen.has(user.userId)) {
      seen.add(user.userId);
      result.push({ userId: user.userId, userName: user.userName });
    }
  }
  return result;
}

function broadcastPresence(nodeId: string) {
  const users = getRoomUsers(nodeId);
  io.to(`note:${nodeId}`).emit('presence-update', { nodeId, users });
}

// ============================================================
// Socket event handlers
// ============================================================

io.on('connection', (socket: Socket) => {
  console.log(`[collab] Connected: ${socket.id}`);

  // Track which rooms this socket is in for cleanup
  const socketRooms = new Set<string>();

  // ---- join-note ----
  socket.on('join-note', (payload: { nodeId: string; userId: string; userName: string }) => {
    const { nodeId, userId, userName } = payload;
    const roomKey = `note:${nodeId}`;

    // Join the socket.io room
    socket.join(roomKey);
    socketRooms.add(nodeId);

    // Track in our presence map
    if (!rooms.has(nodeId)) {
      rooms.set(nodeId, new Map());
    }
    rooms.get(nodeId)!.set(socket.id, { userId, userName, socketId: socket.id });

    console.log(`[collab] ${userName} (${userId}) joined note:${nodeId} via socket ${socket.id}`);

    // Broadcast updated presence to all in the room
    broadcastPresence(nodeId);
  });

  // ---- leave-note ----
  socket.on('leave-note', (payload: { nodeId: string; userId: string }) => {
    const { nodeId } = payload;
    const roomKey = `note:${nodeId}`;

    // Leave the socket.io room
    socket.leave(roomKey);
    socketRooms.delete(nodeId);

    // Remove from presence map
    const room = rooms.get(nodeId);
    if (room) {
      room.delete(socket.id);
      if (room.size === 0) {
        rooms.delete(nodeId);
      }
    }

    console.log(`[collab] User left note:${nodeId} via socket ${socket.id}`);

    // Broadcast updated presence
    broadcastPresence(nodeId);
  });

  // ---- note-update (last-write-wins) ----
  socket.on('note-update', (payload: { nodeId: string; contentJson: string; userId: string }) => {
    const { nodeId, contentJson, userId } = payload;
    const roomKey = `note:${nodeId}`;

    console.log(`[collab] note-update from user ${userId} in note:${nodeId}`);

    // Broadcast to all OTHER users in the room (not the sender)
    socket.to(roomKey).emit('note-update', { nodeId, contentJson, userId });
  });

  // ---- disconnect ----
  socket.on('disconnect', () => {
    console.log(`[collab] Disconnected: ${socket.id}`);

    // Clean up all rooms this socket was in
    for (const nodeId of socketRooms) {
      const room = rooms.get(nodeId);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) {
          rooms.delete(nodeId);
        }
      }
      // Broadcast updated presence
      broadcastPresence(nodeId);
    }
    socketRooms.clear();
  });

  socket.on('error', (error: Error) => {
    console.error(`[collab] Socket error (${socket.id}):`, error);
  });
});

// ============================================================
// Start server on port 3003 (specific port, NOT env variable)
// ============================================================

const PORT = 3003;
httpServer.listen(PORT, () => {
  console.log(`[collab] Real-time collaboration service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[collab] Received SIGTERM, shutting down...');
  httpServer.close(() => {
    console.log('[collab] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[collab] Received SIGINT, shutting down...');
  httpServer.close(() => {
    console.log('[collab] Server closed');
    process.exit(0);
  });
});
