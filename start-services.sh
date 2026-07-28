#!/bin/bash
# Start production server
cd /home/z/my-project
node .next/standalone/server.js > /home/z/my-project/dev.log 2>&1 &
SERVER_PID=$!

# Start office preview mini-service  
cd /home/z/my-project/mini-services/office-preview-service
bun --hot index.ts > /tmp/mini-service.log 2>&1 &
MINI_PID=$!

echo "Server PID: $SERVER_PID"
echo "Mini PID: $MINI_PID"

# Keep the script running so background processes stay alive
while kill -0 $SERVER_PID 2>/dev/null || kill -0 $MINI_PID 2>/dev/null; do
  sleep 5
done
echo "One of the services died"
