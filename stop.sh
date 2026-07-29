#!/bin/bash
# ============================================================
# Multi-Note Stop Script
# Stops all services started by start.sh
# Usage: chmod +x stop.sh && ./stop.sh
# ============================================================

echo "🛑 Stopping Multi-Note services..."

# Kill PIDs from .pids file if it exists
if [ -f .pids ]; then
  PIDS=$(cat .pids)
  for PID in $PIDS; do
    if kill -0 $PID 2>/dev/null; then
      kill $PID 2>/dev/null
      echo "   Stopped PID: $PID"
    fi
  done
  rm .pids
fi

# Also kill any processes on our ports
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null && echo "   Stopped process on port 3000" || true
lsof -ti:3003 2>/dev/null | xargs kill -9 2>/dev/null && echo "   Stopped process on port 3003" || true
lsof -ti:3004 2>/dev/null | xargs kill -9 2>/dev/null && echo "   Stopped process on port 3004" || true

echo ""
echo "✅ All services stopped."
