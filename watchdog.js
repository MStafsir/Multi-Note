/* eslint-disable @typescript-eslint/no-require-imports */
// Watchdog utility - not part of the application codebase
const { spawn } = require('child_process');

function startServer() {
  const server = spawn('node', ['.next/standalone/server.js'], {
    cwd: '/home/z/my-project',
    env: {
      PATH: process.env.PATH,
      PORT: '3000',
      NODE_OPTIONS: '--max-old-space-size=500',
      UV_THREADPOOL_SIZE: '1',
      HOME: process.env.HOME,
      DATABASE_URL: process.env.DATABASE_URL || 'file:/home/z/my-project/db/custom.db',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'workspace-secret-key-dev',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  
  server.stdout.on('data', (data) => {
    process.stdout.write(data);
  });
  
  server.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  
  server.on('exit', () => {
    setTimeout(startServer, 2000);
  });
  
  return server;
}

startServer();
console.log('[watchdog] Running');
