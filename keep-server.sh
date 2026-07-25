#!/bin/bash
cd /home/z/my-project
# Keep-server for production mode
# Copies static assets, then starts server in a loop
# NODE_OPTIONS limits heap to prevent OOM
cp -r .next/static .next/standalone/.next/static 2>/dev/null
cp -r public .next/standalone/public 2>/dev/null
echo "keep-server started at $(date)"
while true; do
  NODE_OPTIONS="--max-old-space-size=1500" node .next/standalone/server.js &
  SERVER_PID=$!
  echo "Server PID: $SERVER_PID at $(date)"
  while kill -0 $SERVER_PID 2>/dev/null; do
    sleep 2
  done
  echo "Server died at $(date), restarting..."
  sleep 2
done
