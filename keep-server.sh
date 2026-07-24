#!/bin/bash
cd /home/z/my-project
while true; do
  node node_modules/.bin/next dev -p 3000 &
  SERVER_PID=$!
  echo "Server started with PID $SERVER_PID at $(date)"
  # Wait for server to die or be killed
  wait $SERVER_PID
  echo "Server died at $(date), restarting..."
  sleep 3
done
