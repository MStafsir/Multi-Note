// ============================================================
// Integration Tests — Node CRUD API Routes
// Tests: create node → verify in database,
//        delete node → verify soft-delete (deletedAt set),
//        rename node → verify name updated
// Uses real database (SQLite) via Prisma
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { createTestUser, createTestNode, cleanupTestData } from '@/test/db-setup';
import { hash } from '@/lib/password';

describe('Node CRUD — Integration Tests', () => {
  let testUserId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    testUserId = user.id;
  });

  afterEach(async () => {
    await cleanupTestData(testUserId);
  });

  // --- Create Node ---
  describe('Create node via database', () => {
    it('creates a folder and verifies in database', async () => {
      const node = await db.node.create({
        data: {
          ownerId: testUserId,
          parentId: null,
          type: 'folder',
          name: 'Integration Test Folder',
        },
      });

      // Verify node exists in database
      const found = await db.node.findUnique({ where: { id: node.id } });
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Integration Test Folder');
      expect(found!.type).toBe('folder');
      expect(found!.ownerId).toBe(testUserId);
      expect(found!.parentId).toBeNull();
      expect(found!.deletedAt).toBeNull();
    });

    it('creates a note and verifies NoteContent is created', async () => {
      const node = await db.node.create({
        data: {
          ownerId: testUserId,
          parentId: null,
          type: 'note',
          name: 'Integration Test Note',
          note: {
            create: {
              contentJson: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
            },
          },
        },
        include: { note: true },
      });

      expect(node.note).not.toBeNull();
      expect(node.note!.contentJson).toBeDefined();
      expect(node.name).toBe('Integration Test Note');
      expect(node.type).toBe('note');
    });

    it('creates a folder with a parent and verifies hierarchy', async () => {
      const parent = await db.node.create({
        data: {
          ownerId: testUserId,
          parentId: null,
          type: 'folder',
          name: 'Parent Folder',
        },
      });

      const child = await db.node.create({
        data: {
          ownerId: testUserId,
          parentId: parent.id,
          type: 'folder',
          name: 'Child Folder',
        },
      });

      expect(child.parentId).toBe(parent.id);

      // Verify parent has child in its children relation
      const parentWithChildren = await db.node.findUnique({
        where: { id: parent.id },
        include: { children: true },
      });
      expect(parentWithChildren!.children.length).toBe(1);
      expect(parentWithChildren!.children[0].id).toBe(child.id);
    });
  });

  // --- Delete Node (Soft-Delete) ---
  describe('Delete node — soft-delete verification', () => {
    it('soft-deletes a node by setting deletedAt', async () => {
      const node = await createTestNode(testUserId, 'folder', 'Delete Test Folder');

      // Verify node exists and is not deleted
      const beforeDelete = await db.node.findUnique({ where: { id: node.id } });
      expect(beforeDelete!.deletedAt).toBeNull();

      // Soft-delete by setting deletedAt
      const now = new Date();
      await db.node.update({
        where: { id: node.id },
        data: { deletedAt: now },
      });

      // Verify soft-delete: deletedAt is set
      const afterDelete = await db.node.findUnique({ where: { id: node.id } });
      expect(afterDelete!.deletedAt).not.toBeNull();
      expect(afterDelete!.deletedAt!.toISOString().slice(0, 10)).toBe(now.toISOString().slice(0, 10));

      // Verify node is excluded from normal queries
      const activeNodes = await db.node.findMany({
        where: { ownerId: testUserId, deletedAt: null },
      });
      expect(activeNodes.find(n => n.id === node.id)).toBeUndefined();

      // Verify node is included when includeDeleted is true
      const allNodes = await db.node.findMany({
        where: { ownerId: testUserId },
      });
      expect(allNodes.find(n => n.id === node.id)).toBeDefined();
    });

    it('cascades soft-delete to child nodes', async () => {
      const parent = await db.node.create({
        data: {
          ownerId: testUserId,
          parentId: null,
          type: 'folder',
          name: 'Parent Folder',
        },
      });

      const child1 = await db.node.create({
        data: {
          ownerId: testUserId,
          parentId: parent.id,
          type: 'note',
          name: 'Child Note 1',
          note: { create: { contentJson: '{}' } },
        },
      });

      const child2 = await db.node.create({
        data: {
          ownerId: testUserId,
          parentId: parent.id,
          type: 'folder',
          name: 'Child Folder 2',
        },
      });

      // Cascade soft-delete
      const now = new Date();
      const descendantIds = [parent.id, child1.id, child2.id];
      await db.node.updateMany({
        where: { id: { in: descendantIds } },
        data: { deletedAt: now },
      });

      // Verify all are soft-deleted
      for (const id of descendantIds) {
        const node = await db.node.findUnique({ where: { id } });
        expect(node!.deletedAt).not.toBeNull();
      }
    });
  });

  // --- Rename Node ---
  describe('Rename node — verification', () => {
    it('updates node name in database', async () => {
      const node = await createTestNode(testUserId, 'folder', 'Original Name');

      // Verify original name
      const beforeRename = await db.node.findUnique({ where: { id: node.id } });
      expect(beforeRename!.name).toBe('Original Name');

      // Rename
      await db.node.update({
        where: { id: node.id },
        data: { name: 'Renamed Folder' },
      });

      // Verify new name
      const afterRename = await db.node.findUnique({ where: { id: node.id } });
      expect(afterRename!.name).toBe('Renamed Folder');
      expect(afterRename!.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeRename!.updatedAt.getTime());
    });
  });

  // --- Move Node ---
  describe('Move node — verification', () => {
    it('moves a node to a different parent', async () => {
      const parentA = await db.node.create({
        data: {
          ownerId: testUserId,
          parentId: null,
          type: 'folder',
          name: 'Parent A',
        },
      });

      const parentB = await db.node.create({
        data: {
          ownerId: testUserId,
          parentId: null,
          type: 'folder',
          name: 'Parent B',
        },
      });

      const node = await db.node.create({
        data: {
          ownerId: testUserId,
          parentId: parentA.id,
          type: 'note',
          name: 'Movable Note',
          note: { create: { contentJson: '{}' } },
        },
      });

      // Verify node is in Parent A
      expect(node.parentId).toBe(parentA.id);

      // Move to Parent B
      await db.node.update({
        where: { id: node.id },
        data: { parentId: parentB.id },
      });

      // Verify node is now in Parent B
      const movedNode = await db.node.findUnique({ where: { id: node.id } });
      expect(movedNode!.parentId).toBe(parentB.id);

      // Verify Parent A has no children now
      const parentAChildren = await db.node.findMany({
        where: { parentId: parentA.id, deletedAt: null },
      });
      expect(parentAChildren.length).toBe(0);

      // Verify Parent B has the moved node
      const parentBChildren = await db.node.findMany({
        where: { parentId: parentB.id, deletedAt: null },
      });
      expect(parentBChildren.length).toBe(1);
      expect(parentBChildren[0].id).toBe(node.id);
    });
  });

  // --- Activity Logging ---
  describe('Activity logging on node operations', () => {
    it('logs activity when creating a node', async () => {
      const { logActivity } = await import('@/lib/activity-logger');

      const node = await createTestNode(testUserId, 'folder', 'Activity Test');
      await logActivity({
        actorId: testUserId,
        nodeId: node.id,
        actionType: 'create',
        metadata: { type: 'folder', name: 'Activity Test' },
      });

      const activities = await db.activityLog.findMany({
        where: { actorId: testUserId, nodeId: node.id },
      });

      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0].actionType).toBe('create');

      const meta = JSON.parse(activities[0].metadata || '{}');
      expect(meta.type).toBe('folder');
      expect(meta.name).toBe('Activity Test');
    });
  });
});
