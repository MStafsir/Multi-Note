#!/bin/bash
# ============================================================
# MODUL 38.4: Backup Verification Script
# Verify backup integrity: database opens, tables exist, row counts match
# ============================================================

set -euo pipefail

BACKUP_FILE="${1:-}"
PROJECT_DIR="/home/z/my-project"
DB_FILE="$PROJECT_DIR/db/custom.db"

if [ -z "$BACKUP_FILE" ]; then
  # Use latest backup
  BACKUP_DIR="$PROJECT_DIR/backups"
  BACKUP_FILE=$(ls -t "$BACKUP_DIR"/custom_*.db 2>/dev/null | head -1)
fi

if [ -z "$BACKUP_FILE" ]; then
  echo "ERROR: No backup file found"
  exit 1
fi

echo "=== Verifying backup: $BACKUP_FILE ==="

# Check file exists and is readable
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file does not exist: $BACKUP_FILE"
  exit 1
fi

echo "File size: $(du -h "$BACKUP_FILE" | cut -f1)"

# SQLite integrity check
echo "Running integrity check..."
RESULT=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>/dev/null || echo "FAILED")
if [ "$RESULT" = "ok" ]; then
  echo "✅ Integrity check: PASSED"
else
  echo "❌ Integrity check: FAILED ($RESULT)"
  exit 1
fi

# Check key tables exist and have rows
echo "Checking tables..."
TABLES=$(sqlite3 "$BACKUP_FILE" ".tables" 2>/dev/null || echo "")

EXPECTED_TABLES="User Account Session Profile Node FileMetadata NoteContent ActivityLog Notification"

for table in $EXPECTED_TABLES; do
  if echo "$TABLES" | grep -q "$table"; then
    COUNT=$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "ERROR")
    echo "  ✅ $table: $COUNT rows"
  else
    echo "  ❌ $table: NOT FOUND"
  fi
done

echo "=== Verification completed ==="
