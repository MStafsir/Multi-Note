#!/bin/bash
# ============================================================
# Switch Database Provider — SQLite ↔ PostgreSQL
# Usage:
#   ./switch-db.sh sqlite      # Switch to SQLite (local dev)
#   ./switch-db.sh postgresql  # Switch to PostgreSQL (Vercel/Supabase)
# ============================================================

set -e

TARGET="${1:-sqlite}"
SCHEMA_DIR="prisma"

if [ "$TARGET" = "postgresql" ] || [ "$TARGET" = "postgres" ]; then
  echo "🔄 Switching to PostgreSQL (Supabase/Neon)..."

  # Copy PostgreSQL schema
  cp "$SCHEMA_DIR/schema.postgresql.prisma" "$SCHEMA_DIR/schema.prisma"

  # Update .env for PostgreSQL
  if [ -f .env ]; then
    # Check if DATABASE_URL already points to PostgreSQL
    if grep -q "postgresql://" .env || grep -q "postgres://" .env; then
      echo "✅ .env already has PostgreSQL DATABASE_URL"
    else
      echo ""
      echo "⚠️  You need to set DATABASE_URL in .env to your PostgreSQL connection string."
      echo "   Example for Supabase:"
      echo '   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"'
      echo ""
      echo "   Get it from: Supabase Dashboard > Settings > Database > Connection string"
    fi
  fi

  echo "✅ Switched to PostgreSQL schema"
  echo "   Run: bun run db:push"

elif [ "$TARGET" = "sqlite" ]; then
  echo "🔄 Switching to SQLite (local dev)..."

  # We need to recreate the SQLite schema from the original
  # The SQLite schema is the same but with provider = "sqlite"
  if [ -f "$SCHEMA_DIR/schema.postgresql.prisma" ]; then
    # Create SQLite schema from PostgreSQL by replacing provider
    sed 's/provider = "postgresql"/provider = "sqlite"/' "$SCHEMA_DIR/schema.postgresql.prisma" > "$SCHEMA_DIR/schema.prisma"
  fi

  # Update .env for SQLite
  if [ -f .env ]; then
    if grep -q "file:" .env; then
      echo "✅ .env already has SQLite DATABASE_URL"
    else
      # Replace PostgreSQL URL with SQLite
      sed -i 's|DATABASE_URL=.*|DATABASE_URL=file:./db/custom.db|' .env
      echo "✅ Updated .env to SQLite"
    fi
  fi

  echo "✅ Switched to SQLite schema"
  echo "   Run: bun run db:push"

else
  echo "❌ Unknown provider: $TARGET"
  echo "   Usage: ./switch-db.sh sqlite | postgresql"
  exit 1
fi
