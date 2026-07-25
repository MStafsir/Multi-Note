#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_OPTIONS="--max-old-space-size=1500" node .next/standalone/server.js &
  SERVER_PID=$!
  echo "Prod server started with PID $SERVER_PID at $(date)"
  wait $SERVER_PID
  echo "Prod server died at $(date), restarting..."
  sleep 2
done
