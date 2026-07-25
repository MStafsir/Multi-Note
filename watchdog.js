// Minimal Node.js watchdog — checks server health and restarts if dead
const { execSync, spawn } = require('child_process');
const http = require('http');

function startServer() {
  console.log('Starting server at ' + new Date().toISOString());
  const child = spawn('node', ['.next/standalone/server.js'], {
    cwd: '/home/z/my-project',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1500', PORT: '3000' },
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  return child.pid;
}

function checkServer() {
  return new Promise((resolve) => {
    const req = http.request('http://localhost:3000/', { method: 'HEAD', timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

let serverPid = startServer();

setInterval(async () => {
  const alive = await checkServer();
  if (!alive) {
    console.log('Server not responding, restarting at ' + new Date().toISOString());
    try { process.kill(serverPid, 'SIGKILL'); } catch {}
    serverPid = startServer();
  }
}, 5000);

console.log('Watchdog started, monitoring server every 5 seconds');
