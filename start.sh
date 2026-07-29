#!/bin/bash
# ============================================================
# Multi-Note Start Script
# Starts all services (main app + mini-services) in background.
# Usage: chmod +x start.sh && ./start.sh
# ============================================================

set -e

echo "🚀 Starting Multi-Note..."
echo ""

# Kill any existing processes on our ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:3003 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:3004 2>/dev/null | xargs kill -9 2>/dev/null || true
echo "Done."
echo ""

# Start collab service (port 3003)
echo "🔌 Starting collab-service on port 3003..."
cd mini-services/collab-service
bun run dev &
COLLAB_PID=$!
cd ../..
echo "   PID: $COLLAB_PID"

# Start comment sync service (port 3004)
echo "🔌 Starting comment-sync-service on port 3004..."
cd mini-services/comment-sync-service
bun run dev &
COMMENT_PID=$!
cd ../..
echo "   PID: $COMMENT_PID"

# Wait a moment for mini-services to start
sleep 2

# Start main app (port 3000)
echo "🌐 Starting main app on port 3000..."
bun run dev &
MAIN_PID=$!
echo "   PID: $MAIN_PID"

echo ""
echo "✅ All services started!"
echo ""
echo "   Main App:        http://localhost:3000 (PID: $MAIN_PID)"
echo "   Collab Service:  port 3003 (PID: $COLLAB_PID)"
echo "   Comment Service: port 3004 (PID: $COMMENT_PID)"
echo ""
echo "To stop all services: ./stop.sh"
echo "Or: kill $MAIN_PID $COLLAB_PID $COMMENT_PID"
echo ""

# Save PIDs for stop script
echo "$MAIN_PID $COLLAB_PID $COMMENT_PID" > .pids

# Wait for any process to exit
wait
