#!/bin/bash
# Production server startup script
cd /home/z/my-project/.next/standalone
export NODE_ENV=production
export PORT=3000
export HOSTNAME=0.0.0.0

# Start the server and keep it running
exec node server.js
