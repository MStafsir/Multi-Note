#!/bin/bash
# ============================================================
# keep-server.sh — Production server auto-restart daemon
# Handles OOM kills by immediately restarting the server
# The server starts in ~70ms, so downtime is minimal
# ============================================================

cd /home/z/my-project
LOG_FILE="dev.log"

# Clear old log
> "$LOG_FILE"

RESTART_COUNT=0

while true; do
  RESTART_COUNT=$((RESTART_COUNT + 1))
  echo "[keep-server] Starting production server (attempt #$RESTART_COUNT) at $(date)" >> "$LOG_FILE"
  
  # Start the server with memory limits
  NODE_OPTIONS="--max-old-space-size=500" PORT=3000 node .next/standalone/server.js >> "$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  
  echo "[keep-server] Server PID: $SERVER_PID" >> "$LOG_FILE"
  
  # Wait up to 5 seconds for server to be ready
  READY=false
  for i in 1 2 3 4 5; do
    sleep 1
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200"; then
      READY=true
      echo "[keep-server] Server ready after ${i}s" >> "$LOG_FILE"
      break
    fi
  done
  
  if [ "$READY" = false ]; then
    echo "[keep-server] Server failed to start within 5s" >> "$LOG_FILE"
  fi
  
  # Monitor server process — check every 3 seconds
  LAST_CHECK=$(date +%s)
  while kill -0 $SERVER_PID 2>/dev/null; do
    sleep 3
  done
  
  # Server died — calculate uptime
  NOW=$(date +%s)
  UPTIME=$((NOW - LAST_CHECK))
  echo "[keep-server] Server died after ~${UPTIME}s uptime. Restarting..." >> "$LOG_FILE"
  
  # Brief pause before restart
  sleep 2
done
