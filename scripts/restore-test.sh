#!/bin/bash
# ============================================================
# MODUL 38.7: Restore Test Script — Disaster Recovery Drill
# Restore from backup to empty environment, measure time-to-recovery
# ============================================================

set -euo pipefail

PROJECT_DIR="/home/z/my-project"
BACKUP_DIR="$PROJECT_DIR/backups"
TEST_DIR="$PROJECT_DIR/test-restore-$$"
DB_FILE="$PROJECT_DIR/db/custom.db"

echo "=== Disaster Recovery Drill — Restore Test ==="
echo "Started at: $(date)"

START_TIME=$(date +%s)

# 38.7 — Step 1: Find latest backup
BACKUP_FILE=$(ls -t "$BACKUP_DIR"/custom_*.db 2>/dev/null | head -1)
if [ -z "$BACKUP_FILE" ]; then
  echo "ERROR: No backup found in $BACKUP_DIR"
  echo "Run 'bun run scripts/backup.sh' first to create a backup"
  exit 1
fi

echo "Using backup: $BACKUP_FILE"

# 38.7 — Step 2: Create test environment
echo "Creating test environment..."
mkdir -p "$TEST_DIR/db"

# 38.7 — Step 3: Restore database from backup
echo "Restoring database..."
cp "$BACKUP_FILE" "$TEST_DIR/db/custom.db"

RESTORE_DB_TIME=$(date +%s)
RESTORE_DURATION=$((RESTORE_DB_TIME - START_TIME))
echo "Database restore completed in ${RESTORE_DURATION}s"

# 38.7 — Step 4: Verify restored database
echo "Verifying restored database..."

# Integrity check
RESULT=$(sqlite3 "$TEST_DIR/db/custom.db" "PRAGMA integrity_check;" 2>/dev/null || echo "FAILED")
if [ "$RESULT" = "ok" ]; then
  echo "✅ Integrity check: PASSED"
else
  echo "❌ Integrity check: FAILED"
fi

# Check tables
TABLES=$(sqlite3 "$TEST_DIR/db/custom.db" ".tables" 2>/dev/null || echo "")
echo "Tables found: $TABLES"

# Row counts
USER_COUNT=$(sqlite3 "$TEST_DIR/db/custom.db" "SELECT COUNT(*) FROM User;" 2>/dev/null || echo "0")
NODE_COUNT=$(sqlite3 "$TEST_DIR/db/custom.db" "SELECT COUNT(*) FROM Node WHERE deletedAt IS NULL;" 2>/dev/null || echo "0")
echo "Users: $USER_COUNT, Nodes: $NODE_COUNT"

# 38.7 — Step 5: Check file storage backup
UPLOAD_BACKUP=$(ls -td "$BACKUP_DIR"/upload_* 2>/dev/null | head -1)
if [ -n "$UPLOAD_BACKUP" ]; then
  echo "File storage backup found: $UPLOAD_BACKUP"
  FILE_COUNT=$(find "$UPLOAD_BACKUP" -type f | wc -l || echo "0")
  echo "Files in backup: $FILE_COUNT"
else
  echo "⚠️ No file storage backup found"
fi

# 38.7 — Step 6: Calculate total time
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo ""
echo "=== Restore Test Results ==="
echo "Total time-to-recovery: ${TOTAL_DURATION} seconds"
echo "RTO target: 4 hours (14400 seconds)"
echo "RTO gap: $((14400 - TOTAL_DURATION)) seconds remaining"

if [ "$TOTAL_DURATION" -lt 14400 ]; then
  echo "✅ RTO TARGET MET — Restore completed within 4 hours"
else
  echo "❌ RTO TARGET NOT MET — Restore exceeded 4 hours"
  echo "Action needed: Review bottlenecks and update runbook"
fi

echo ""
echo "=== Cleanup ==="
echo "Removing test environment..."
rm -rf "$TEST_DIR"

echo "Drill completed at: $(date)"
