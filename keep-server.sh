#!/bin/bash
# Keep-server: Production mode with auto-restart (OOM mitigation)
# The server periodically gets OOM killed; this script keeps it alive

cd /home/z/my-project
LOG_FILE="dev.log"

while true; do
  echo "[keep-server] Starting production server at $(date)" >> "$LOG_FILE"
  NODE_OPTIONS="--max-old-space-size=600" PORT=3000 node .next/standalone/server.js >> "$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  echo "[keep-server] Server PID: $SERVER_PID" >> "$LOG_FILE"
  
  # Wait for server to start responding
  MAX_WAIT=10
  for i in $(seq 1 $MAX_WAIT); do
    sleep 1
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200"; then
      echo "[keep-server] Server ready after ${i}s" >> "$LOG_FILE"
      break
    fi
  done
  
  # Keep checking if process is alive
  while kill -0 $SERVER_PID 2>/dev/null; do
    sleep 5
  done
  
  echo "[keep-server] Server died (OOM likely). Restarting in 2s..." >> "$LOG_FILE"
  sleep 2
done
