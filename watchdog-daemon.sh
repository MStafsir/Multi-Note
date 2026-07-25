#!/bin/bash
# Watchdog daemon for Next.js production server
# Uses setsid to keep server alive across shell session boundaries

cd /home/z/my-project
LOG_FILE="/home/z/my-project/daemon.log"

echo "[$(date)] Watchdog daemon starting..." >> "$LOG_FILE"

while true; do
  # Check if server is already running on port 3000
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200"; then
    echo "[$(date)] Server is running, health check OK" >> "$LOG_FILE"
  else
    echo "[$(date)] Server not responding, starting..." >> "$LOG_FILE"
    # Start server in a new session group (detached from parent)
    setsid node .next/standalone/server.js >> "$LOG_FILE" 2>&1 &
    disown
    # Wait for server to start
    sleep 5
    # Verify it started
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200"; then
      echo "[$(date)] Server started successfully" >> "$LOG_FILE"
    else
      echo "[$(date)] Server failed to start" >> "$LOG_FILE"
    fi
  fi
  sleep 30
done
