#!/bin/bash
# Daemon script for Next.js production server
# Double-fork to fully detach from any terminal session

# First fork
(
  # Second fork - this is the actual daemon
  (
    cd /home/z/my-project/.next/standalone
    export NODE_ENV=production
    export PORT=3000
    export HOSTNAME=0.0.0.0
    
    # Write PID file
    echo $$ > /home/z/my-project/server.pid
    
    # Start the server
    exec node server.js >> /home/z/my-project/server.log 2>&1
  ) &
  # Exit first fork
) &
# Exit main script

echo "Server daemon started"
