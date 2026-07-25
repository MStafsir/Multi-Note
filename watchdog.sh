#!/bin/bash
cd /home/z/my-project
while true; do
  if ! pgrep -f "server.js" > /dev/null 2>&1; then
    echo "No server found, starting at $(date)" >> /home/z/my-project/watchdog.log
    setsid node .next/standalone/server.js >> /home/z/my-project/dev.log 2>&1 &
    sleep 3
  fi
  sleep 5
done
