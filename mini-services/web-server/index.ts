import { spawn } from 'child_process';
import { join } from 'path';

const standaloneDir = join(import.meta.dir, '../../.next/standalone');

console.log('Starting Next.js production server...');

const server = spawn('node', ['server.js'], {
  cwd: standaloneDir,
  env: { ...process.env, NODE_ENV: 'production', PORT: '3000', HOSTNAME: '0.0.0.0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

server.stdout.on('data', (data) => {
  console.log(data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.error(data.toString().trim());
});

server.on('exit', (code, signal) => {
  console.log(`Server exited with code ${code}, signal ${signal}`);
  // Restart after 2 seconds
  console.log('Restarting in 2 seconds...');
  setTimeout(() => {
    console.log('Restarting server...');
    const newServer = spawn('node', ['server.js'], {
      cwd: standaloneDir,
      env: { ...process.env, NODE_ENV: 'production', PORT: '3000', HOSTNAME: '0.0.0.0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    newServer.stdout.on('data', (data) => console.log(data.toString().trim()));
    newServer.stderr.on('data', (data) => console.error(data.toString().trim()));
    newServer.on('exit', (code, signal) => {
      console.log(`Server exited again with code ${code}, signal ${signal}`);
    });
  }, 2000);
});

console.log('Web server mini-service started');
