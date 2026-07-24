#!/bin/bash
cd /home/z/my-project

# Start the server
setsid node node_modules/.bin/next dev -p 3000 > /tmp/next-server.log 2>&1 &
disown

# Wait for compilation
echo "Waiting for server to compile..."
for i in {1..30}; do
  sleep 1
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | rg -q "200"; then
    echo "Server is up!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "Server failed to start"
    exit 1
  fi
done

# Give it a moment to stabilize
sleep 5

# Verify the page content
echo "=== HTML Content Verification ==="
HTML=$(curl -s http://localhost:3000/)
echo "$HTML" | rg -o "Unified Workspace" | head -3
echo "=== Session API ==="
curl -s http://localhost:3000/api/auth/session
echo ""
echo "=== Register API ==="
curl -s -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"email":"module21@test.com","name":"Module21Test","password":"test123456"}'
echo ""
echo "=== Tags API ==="
curl -s http://localhost:3000/api/tags
echo ""
echo "=== Memory Status ==="
free -m
echo "=== Server Log ==="
tail -10 /tmp/next-server.log
