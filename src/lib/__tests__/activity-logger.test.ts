// ============================================================
// Unit Tests — Activity Logger
// Tests: logActivity creates correct database records
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-logger';
import { createTestUser, cleanupTestData } from '@/test/db-setup';

describe('activityLogger', () => {
  let testUserId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    testUserId = user.id;
  });

  afterEach(async () => {
    await cleanupTestData(testUserId);
  });

  it('creates activity log entry with correct fields', async () => {
    await logActivity({
      actorId: testUserId,
      actionType: 'create',
      metadata: { type: 'folder', name: 'Test Folder' },
    });

    const activities = await db.activityLog.findMany({
      where: { actorId: testUserId },
    });

    expect(activities.length).toBe(1);
    expect(activities[0].actionType).toBe('create');
    expect(activities[0].actorId).toBe(testUserId);

    const meta = JSON.parse(activities[0].metadata || '{}');
    expect(meta.type).toBe('folder');
    expect(meta.name).toBe('Test Folder');
  });

  it('creates activity log with nodeId', async () => {
    const node = await db.node.create({
      data: {
        ownerId: testUserId,
        parentId: null,
        type: 'folder',
        name: 'Test',
      },
    });

    await logActivity({
      actorId: testUserId,
      nodeId: node.id,
      actionType: 'rename',
      metadata: { oldName: 'Test', newName: 'Renamed' },
    });

    const activities = await db.activityLog.findMany({
      where: { actorId: testUserId, nodeId: node.id },
    });

    expect(activities.length).toBe(1);
    expect(activities[0].actionType).toBe('rename');
    expect(activities[0].nodeId).toBe(node.id);
  });

  it('handles all action types', async () => {
    const actionTypes = ['create', 'rename', 'move', 'delete', 'restore', 'share', 'edit'];

    for (const actionType of actionTypes) {
      await logActivity({
        actorId: testUserId,
        actionType: actionType as 'create' | 'rename' | 'move' | 'delete' | 'restore' | 'share' | 'edit',
      });
    }

    const activities = await db.activityLog.findMany({
      where: { actorId: testUserId },
      orderBy: { createdAt: 'asc' },
    });

    expect(activities.length).toBe(actionTypes.length);
    for (let i = 0; i < actionTypes.length; i++) {
      expect(activities[i].actionType).toBe(actionTypes[i]);
    }
  });

  it('creates activity log without metadata (optional)', async () => {
    await logActivity({
      actorId: testUserId,
      actionType: 'delete',
    });

    const activities = await db.activityLog.findMany({
      where: { actorId: testUserId },
    });

    expect(activities.length).toBe(1);
    expect(activities[0].metadata).toBeNull();
  });
});
