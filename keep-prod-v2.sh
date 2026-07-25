#!/bin/bash
cd /home/z/my-project
while true; do
  echo "=== Starting production server at $(date) ===" >> /home/z/my-project/prod-server.log
  node .next/standalone/server.js >> /home/z/my-project/prod-server.log 2>&1
  EXIT_CODE=$?
  echo "=== Server exited with code $EXIT_CODE at $(date) ===" >> /home/z/my-project/prod-server.log
  sleep 2
done
