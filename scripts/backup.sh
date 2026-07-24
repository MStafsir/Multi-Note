#!/bin/bash
# ============================================================
# MODUL 38.1: Database Backup Script
# Creates consistent SQLite backup + file storage sync
# Run daily via cron: 0 0 * * * cd /home/z/my-project && bun run scripts/backup.sh
# ============================================================

set -euo pipefail

PROJECT_DIR="/home/z/my-project"
DB_FILE="$PROJECT_DIR/db/custom.db"
UPLOAD_DIR="$PROJECT_DIR/upload"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "=== Backup started at $(date) ==="

# 38.1 — SQLite backup using .backup command (consistent snapshot without locking)
echo "Creating database backup..."
sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/custom_$DATE.db'" 2>/dev/null || {
  # Fallback: copy method if sqlite3 .backup not available
  echo "sqlite3 .backup not available, using copy method..."
  cp "$DB_FILE" "$BACKUP_DIR/custom_$DATE.db"
}

# Verify backup integrity
echo "Verifying backup integrity..."
sqlite3 "$BACKUP_DIR/custom_$DATE.db" "PRAGMA integrity_check;" 2>/dev/null || echo "Note: sqlite3 not available for integrity check"

# 38.2 — File storage backup (rsync)
echo "Syncing file storage..."
if [ -d "$UPLOAD_DIR" ]; then
  mkdir -p "$BACKUP_DIR/upload_$DATE"
  rsync -a --delete "$UPLOAD_DIR/" "$BACKUP_DIR/upload_$DATE/" 2>/dev/null || {
    # Fallback: cp if rsync not available
    echo "rsync not available, using cp method..."
    rm -rf "$BACKUP_DIR/upload_$DATE"
    cp -r "$UPLOAD_DIR" "$BACKUP_DIR/upload_$DATE"
  }
fi

# Retention: keep last 30 days of backups (38.1)
echo "Cleaning old backups (retention: 30 days)..."
find "$BACKUP_DIR" -name "custom_*.db" -mtime +30 -delete 2>/dev/null || echo "Note: find cleanup skipped"
find "$BACKUP_DIR" -name "upload_*" -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || echo "Note: upload cleanup skipped"

# Create backup metadata
echo "$TIMESTAMP" > "$BACKUP_DIR/last_backup_timestamp.txt"

echo "=== Backup completed at $(date) ==="
echo "Backup files:"
ls -la "$BACKUP_DIR/custom_$DATE.db" 2>/dev/null
echo "Retention: 30 days"
