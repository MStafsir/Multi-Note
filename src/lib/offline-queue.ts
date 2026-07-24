// ============================================================
// MODUL 24.3 + 24.4: Offline Queue — IndexedDB note editing
// When saving a note fails (network error), queue the change
// in IndexedDB. When connection returns, sync queued changes
// via Background Sync API or polling.
// MODUL 24.4: Conflict handling — check server's updatedAt
// vs local updatedAt before applying a queued edit
// ============================================================

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { toast } from 'sonner';

interface NoteEdit {
  id: string;
  nodeId: string;
  contentJson: string;
  updatedAt: string; // local timestamp when edit was made
  synced: boolean;
  createdAt: string; // when this edit was queued
}

interface UwOfflineDB extends DBSchema {
  'note-edits': {
    key: string;
    value: NoteEdit;
    indexes: {
      'by-nodeId': string;
      'by-synced': boolean;
    };
  };
}

const DB_NAME = 'uw-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<UwOfflineDB> | null = null;

async function getDB(): Promise<IDBPDatabase<UwOfflineDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<UwOfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore('note-edits', { keyPath: 'id' });
      store.createIndex('by-nodeId', 'nodeId');
      store.createIndex('by-synced', 'synced');
    },
  });

  return dbInstance;
}

// Generate a unique ID for queued edits
function generateId(): string {
  return `edit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================
// Queue a failed note edit
// ============================================================

export async function queueNoteEdit(
  nodeId: string,
  contentJson: string,
  updatedAt: string
): Promise<string> {
  const db = await getDB();
  const editId = generateId();

  const edit: NoteEdit = {
    id: editId,
    nodeId,
    contentJson,
    updatedAt,
    synced: false,
    createdAt: new Date().toISOString(),
  };

  await db.put('note-edits', edit);
  return editId;
}

// ============================================================
// Get all unsynced edits for a specific node
// ============================================================

export async function getUnsyncedEdits(nodeId: string): Promise<NoteEdit[]> {
  const db = await getDB();
  const allEdits = await db.getAllFromIndex('note-edits', 'by-nodeId', nodeId);
  return allEdits.filter(edit => !edit.synced);
}

// ============================================================
// Get all unsynced edits across all nodes
// ============================================================

export async function getAllUnsyncedEdits(): Promise<NoteEdit[]> {
  const db = await getDB();
  const allEdits = await db.getAllFromIndex('note-edits', 'by-synced', false);
  return allEdits;
}

// ============================================================
// Mark an edit as synced
// ============================================================

export async function markEditSynced(editId: string): Promise<void> {
  const db = await getDB();
  const edit = await db.get('note-edits', editId);
  if (edit) {
    edit.synced = true;
    await db.put('note-edits', edit);
  }
}

// ============================================================
// Delete a synced edit (cleanup)
// ============================================================

export async function deleteSyncedEdits(): Promise<void> {
  const db = await getDB();
  const syncedEdits = await db.getAllFromIndex('note-edits', 'by-synced', true);
  for (const edit of syncedEdits) {
    await db.delete('note-edits', edit.id);
  }
}

// ============================================================
// MODUL 24.4: Sync queued changes with conflict handling
// Before applying a queued edit, check server's updatedAt vs local updatedAt
// If server is newer, show a merge prompt (toast) asking user to choose
// ============================================================

export async function syncQueuedEdits(): Promise<{
  synced: number;
  conflicts: number;
  errors: number;
}> {
  const unsyncedEdits = await getAllUnsyncedEdits();
  let synced = 0;
  let conflicts = 0;
  let errors = 0;

  for (const edit of unsyncedEdits) {
    try {
      // First, fetch the current server state to check for conflicts
      const serverRes = await fetch(`/api/nodes/${edit.nodeId}`);
      const serverData = await serverRes.json();

      if (!serverData.success) {
        errors++;
        continue;
      }

      const serverUpdatedAt = serverData.data?.updatedAt;

      // Conflict detection: if server was updated after our local edit was created
      if (serverUpdatedAt && new Date(serverUpdatedAt) > new Date(edit.updatedAt)) {
        // Server has newer content — conflict!
        conflicts++;

        // Show merge prompt toast asking user to choose
        toast.warning(
          `Conflict detected for note "${serverData.data?.name || edit.nodeId}"`,
          {
            description: 'The server has newer content. Would you like to overwrite it with your local changes?',
            duration: 10000,
            action: {
              label: 'Overwrite server',
              onClick: async () => {
                // User chose to overwrite server content
                try {
                  const patchRes = await fetch(`/api/nodes/${edit.nodeId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contentJson: edit.contentJson }),
                  });
                  const patchData = await patchRes.json();
                  if (patchData.success) {
                    await markEditSynced(edit.id);
                    toast.success('Local changes saved to server');
                  } else {
                    toast.error('Failed to overwrite server content');
                  }
                } catch {
                  toast.error('Failed to overwrite server content');
                }
              },
            },
            cancel: {
              label: 'Keep server',
              onClick: async () => {
                // User chose to keep server content — discard local edit
                await markEditSynced(edit.id);
                toast.success('Server content kept, local edit discarded');
              },
            },
          }
        );

        // Don't auto-sync this edit — wait for user decision
        continue;
      }

      // No conflict — apply the edit
      const patchRes = await fetch(`/api/nodes/${edit.nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentJson: edit.contentJson }),
      });

      const patchData = await patchRes.json();
      if (patchData.success) {
        await markEditSynced(edit.id);
        synced++;
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }

  // Clean up synced edits
  await deleteSyncedEdits();

  return { synced, conflicts, errors };
}

// ============================================================
// Get count of unsynced edits (for UI indicator)
// ============================================================

export async function getUnsyncedCount(): Promise<number> {
  const unsynced = await getAllUnsyncedEdits();
  return unsynced.length;
}

// ============================================================
// Register Background Sync (if supported)
// ============================================================

export function registerBackgroundSync(): void {
  if ('serviceWorker' in navigator && 'SyncManager' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.sync.register('sync-note-edits');
    }).catch(() => {
      // Background Sync not available — will fall back to polling
    });
  }
}
