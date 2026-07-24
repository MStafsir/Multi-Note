# ============================================================
# MODUL 38: Disaster Recovery & Backup Strategy
# ============================================================

## 38.1 — Database Backup

### Strategy: SQLite File-Level Backup

Since the project uses SQLite (file-based), backup strategy differs from Postgres PITR:

- **Automated daily backup**: Use `scripts/backup.sh` to create a consistent copy of the SQLite database
- **Backup method**: SQLite `.backup` command (creates consistent snapshot without locking the DB)
- **Retention**: 30 days of daily backups (configurable)
- **RPO (Recovery Point Objective)**: Maximum 24 hours — worst case is losing 1 day of data
- **Backup location**: `/home/z/my-project/backups/` directory

### Backup Command
```bash
bun run scripts/backup.sh
```

This runs daily at 00:00 via cron (or manually).

### Supabase/Postgres Migration Note
When migrating to Supabase Postgres:
- Enable Supabase automated daily backup with PITR
- Retention per tier plan (7 days free, 30 days pro)
- RPO remains max 24 hours

## 38.2 — Storage Backup

### Current: Local File Storage
- Uploaded files stored in `/home/z/my-project/upload/` directory
- Backup script includes file directory synchronization
- Scheduled sync to external object storage (Cloudflare R2/S3) recommended for production

### Production Migration
- Use Supabase Storage for file uploads
- Configure bucket replication to separate object storage (Cloudflare R2 or AWS S3)
- Prevents single-point-of-failure with one provider

## 38.3 — Recovery Time Objective (RTO)

**RTO Target**: Maximum 4 hours from incident to full service restoration

### Restore Runbook (Step-by-Step)

#### Step 1: Assess Incident (0-15 min)
1. Identify the nature of the incident (data corruption, server failure, security breach)
2. Determine which components are affected (database, storage, application server)
3. Notify stakeholders (see 38.5 communication template)

#### Step 2: Stop Data Loss (15-30 min)
1. If active corruption: stop the application server immediately
   ```bash
   # Kill the dev server / production server
   pkill -f "next dev" || pkill -f "node server.js"
   ```
2. If security breach: revoke compromised credentials
3. Preserve current state — do NOT modify affected files

#### Step 3: Identify Restore Point (30-45 min)
1. List available backups:
   ```bash
   ls -la /home/z/my-project/backups/
   ```
2. Select the most recent backup before the incident
3. Verify backup integrity:
   ```bash
   bun run scripts/verify-backup.sh <backup-file>
   ```

#### Step 4: Execute Restore (45-120 min)
1. Stop the application (if still running)
2. Copy backup database to replace corrupted one:
   ```bash
   cp /home/z/my-project/backups/custom_YYYYMMDD.db /home/z/my-project/db/custom.db
   ```
3. Restore file storage from backup:
   ```bash
   rsync -av /home/z/my-project/backups/upload_YYYYMMDD/ /home/z/my-project/upload/
   ```
4. Verify restore integrity:
   ```bash
   bun run scripts/verify-backup.sh /home/z/my-project/db/custom.db
   ```
5. Run Prisma migrations if needed:
   ```bash
   bun run db:push
   ```
6. Start the application:
   ```bash
   bun run dev
   ```

#### Step 5: Validate Restoration (120-180 min)
1. Verify key functionality: login, file upload, note creation, search
2. Check data integrity: compare node counts, user counts with pre-incident values
3. Run automated checks (if available)
4. Monitor for any anomalies

#### Step 6: Communicate & Document (180-240 min)
1. Send status page update: "Service restored"
2. Document the incident timeline and root cause
3. Identify preventive measures
4. Update this runbook if new lessons learned

## 38.4 — Backup Verification

### Monthly Restore Test
- **Schedule**: 1st of each month (or equivalent)
- **Process**: Restore from backup to a separate test environment
- **Script**: `scripts/restore-test.sh`
- **Verification checklist**:
  1. Database opens without errors
  2. All tables have expected row counts
  3. User login works
  4. File uploads are accessible
  5. Note content is readable
  6. No data loss beyond the RPO window (24 hours)

### Test Command
```bash
bun run scripts/restore-test.sh
```

This creates a temporary environment, restores the latest backup, and runs validation checks.

## 38.5 — Incident Response & Escalation

### Escalation Tiers
- **Tier 1 (0-30 min)**: On-call engineer assesses incident, determines severity
- **Tier 2 (30-60 min)**: Senior engineer develops restore plan, executes
- **Tier 3 (60-120 min)**: Architect/CTO oversight for critical decisions

### Communication Template — Status Page
```
[INCIDENT] Unified Workspace — Service Disruption

Status: [Investigating | Identified | Monitoring | Resolved]

Summary: [Brief description of the incident]

Impact: [Number of users affected, features unavailable]

Timeline:
- [HH:MM] Incident detected
- [HH:MM] Investigation started
- [HH:MM] Root cause identified
- [HH:MM] Restore plan initiated
- [HH:MM] Service restored

Next Update: [Expected time for next update]

— Unified Workspace Team
```

### On-Call Rotation (if team > 1 engineer)
- Rotate weekly between available engineers
- On-call engineer must be reachable within 15 minutes
- Escalation path documented in internal wiki

## 38.6 — Data Corruption Rollback

### Procedure for Silent Data Corruption
1. Identify the corrupted data (migration bug, application bug, manual error)
2. Determine the corruption timestamp (when did it start)
3. Select a PITR point before corruption started
4. Execute restore to that snapshot (see Step 4 above)
5. **Communicate data-loss window** to affected users:
   - What data was lost: timestamps, types of data
   - What actions were taken: restoration details
   - Preventive measures implemented

### Example Communication
```
[DATA INCIDENT] Unified Workspace — Data Recovery Notice

During a recent update, some user data was inadvertently affected.
We have restored the system from a backup taken on [DATE].

Data loss window: [START_TIME] to [END_TIME] (approximately [HOURS] hours)

Affected data:
- [List types of data affected: notes, files, etc.]

If you created or modified content during this window, please check
your workspace and re-create any missing items.

We have implemented [PREVENTIVE MEASURE] to prevent this in the future.

— Unified Workspace Team
```

## 38.7 — Testing: Disaster Recovery Drill

### Drill Checklist
1. Execute `bun run scripts/restore-test.sh`
2. Measure actual time-to-recovery from start to full service
3. Compare against RTO target (4 hours)
4. Document any gaps or delays
5. If target not met: identify bottlenecks, update runbook, schedule follow-up drill

### Expected Results
- Restore from backup to empty environment: < 30 minutes (SQLite file copy)
- Validation checks: < 15 minutes
- Total recovery time: < 1 hour for SQLite-based system
- This is well within the 4-hour RTO target

### Production Considerations
- When using Supabase Postgres, restore time may be longer (PITR restore via Supabase dashboard)
- Network latency and database size affect restore time
- Test with production-sized data for realistic timing
