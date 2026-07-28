#!/bin/bash
# Keep-alive script that restarts the production server if it dies
LOG="/home/z/my-project/server.log"
while true; do
  cd /home/z/my-project/.next/standalone
  NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 node server.js >> $LOG 2>&1
  echo "Server died at $(date), restarting in 2s..." >> $LOG
  sleep 2
done
