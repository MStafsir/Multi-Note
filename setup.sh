#!/bin/bash
# ============================================================
# Multi-Note Setup Script
# Run this after cloning the repo to set up the project.
# Usage: chmod +x setup.sh && ./setup.sh
# ============================================================

set -e

echo "🚀 Multi-Note Setup"
echo "===================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if bun is installed
check_bun() {
  if command -v bun &> /dev/null; then
    echo -e "${GREEN}✓${NC} bun is installed ($(bun --version))"
    return 0
  else
    echo -e "${RED}✗${NC} bun is NOT installed"
    echo "  Install bun: curl -fsSL https://bun.sh/install | bash"
    return 1
  fi
}

# Check if node is installed (fallback)
check_node() {
  if command -v node &> /dev/null; then
    echo -e "${GREEN}✓${NC} node is installed ($(node --version))"
    return 0
  else
    echo -e "${YELLOW}!${NC} node is NOT installed (optional, bun is preferred)"
    return 0
  fi
}

# Step 1: Check prerequisites
echo "📋 Step 1: Checking prerequisites..."
check_bun
BUN_OK=$?
check_node

if [ $BUN_OK -ne 0 ]; then
  echo ""
  echo -e "${RED}Error: bun is required but not installed.${NC}"
  echo "Install it with: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi
echo ""

# Step 2: Create required directories
echo "📁 Step 2: Creating required directories..."
mkdir -p upload
mkdir -p db
echo -e "${GREEN}✓${NC} Created upload/ and db/ directories"
echo ""

# Step 3: Create .env file if not exists
echo "⚙️  Step 3: Setting up environment variables..."
if [ ! -f .env ]; then
  cat > .env << 'EOF'
DATABASE_URL=file:./db/custom.db
NEXTAUTH_SECRET=dev-secret-key-change-in-production-abc123xyz
EOF
  echo -e "${GREEN}✓${NC} Created .env file with default values"
  echo -e "${YELLOW}⚠${NC}  IMPORTANT: Change NEXTAUTH_SECRET in production!"
else
  echo -e "${GREEN}✓${NC} .env file already exists"
fi
echo ""

# Step 4: Install main project dependencies
echo "📦 Step 4: Installing main project dependencies..."
bun install
echo -e "${GREEN}✓${NC} Main project dependencies installed"
echo ""

# Step 5: Setup Prisma database
echo "🗄️  Step 5: Setting up database..."
bun run db:generate
bun run db:push
echo -e "${GREEN}✓${NC} Database schema created and Prisma client generated"
echo ""

# Step 6: Install mini-service dependencies
echo "🔌 Step 6: Installing mini-service dependencies..."

# Collab service (port 3003)
cd mini-services/collab-service
bun install
cd ../..
echo -e "${GREEN}✓${NC} collab-service (port 3003) dependencies installed"

# Comment sync service (port 3004)
cd mini-services/comment-sync-service
bun install
cd ../..
echo -e "${GREEN}✓${NC} comment-sync-service (port 3004) dependencies installed"
echo ""

# Step 7: Done!
echo "✅ Setup Complete!"
echo ""
echo "===================="
echo "To start the project:"
echo ""
echo "  Option 1: Start everything manually"
echo "  -----------------------------------"
echo "  # Terminal 1: Start collab service"
echo "  cd mini-services/collab-service && bun run dev"
echo ""
echo "  # Terminal 2: Start comment sync service"
echo "  cd mini-services/comment-sync-service && bun run dev"
echo ""
echo "  # Terminal 3: Start main app"
echo "  bun run dev"
echo ""
echo "  Option 2: Start all at once (background)"
echo "  -----------------------------------------"
echo "  ./start.sh"
echo ""
echo "The app will be available at http://localhost:3000"
echo ""
echo "Note: Real-time collaboration features (Socket.IO) require the"
echo "mini-services to be running. The app works without them, but"
echo "collab and comment sync features will be disabled."
echo ""
