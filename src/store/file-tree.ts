// ============================================================
// MODUL 4.2: Zustand Store — File Tree State & Selection
// Optimistic update with rollback on error
// ============================================================

import { create } from 'zustand';
import type { TreeNode, NodeType } from '@/types';

// MODUL 69.4: Persist sort preference to localStorage
const SORT_PREF_KEY = 'app-sort-preference';

function getInitialSortPreference(): { sortBy: 'name' | 'createdAt'; sortDirection: 'asc' | 'desc' } {
  if (typeof window === 'undefined') return { sortBy: 'name', sortDirection: 'asc' };
  try {
    const stored = localStorage.getItem(SORT_PREF_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.sortBy === 'name' || parsed.sortBy === 'createdAt') {
        return {
          sortBy: parsed.sortBy,
          sortDirection: parsed.sortDirection === 'desc' ? 'desc' : 'asc',
        };
      }
    }
  } catch { /* localStorage not available */ }
  return { sortBy: 'name', sortDirection: 'asc' };
}

interface FileTreeState {
  // Tree data
  tree: TreeNode[];
  flatNodes: Map<string, TreeNode>;

  // Current folder being viewed
  currentFolderId: string | null;
  currentFolderPath: { id: string | null; name: string }[];

  // Selection state (8.3, 18.1)
  selectedNodeIds: Set<string>;
  selectionMode: 'single' | 'multi';

  // UI state
  expandedFolderIds: Set<string>;
  isLoading: boolean;
  error: string | null;

  // 17 — Active view state ('workspace' | 'trash' | 'admin')
  activeView: 'workspace' | 'trash' | 'admin';

  // MODUL 69.4: Sort state — shared across components
  sortBy: 'name' | 'createdAt';
  sortDirection: 'asc' | 'desc';

  // Actions
  setTree: (nodes: TreeNode[]) => void;
  setCurrentFolder: (folderId: string | null, path: { id: string | null; name: string }[]) => void;
  selectNode: (nodeId: string, mode?: 'single' | 'multi') => void;
  clearSelection: () => void;
  toggleFolderExpand: (folderId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setActiveView: (view: 'workspace' | 'trash' | 'admin') => void;
  setSortPreference: (sortBy: 'name' | 'createdAt', sortDirection: 'asc' | 'desc') => void;

  // Optimistic updates (4.2)
  optimisticRename: (nodeId: string, newName: string) => string | null; // returns old name for rollback
  rollbackRename: (nodeId: string, oldName: string) => void;
  optimisticMove: (nodeId: string, newParentId: string | null) => { oldParentId: string | null } | null;
  rollbackMove: (nodeId: string, oldParentId: string | null) => void;
  optimisticDelete: (nodeIds: string[]) => Map<string, { parentId: string | null }>;
  rollbackDelete: (deletedNodes: Map<string, { parentId: string | null }>) => void;

  addNode: (node: TreeNode) => void;
  removeNode: (nodeId: string) => void;
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  tree: [],
  flatNodes: new Map(),
  currentFolderId: null,
  currentFolderPath: [{ id: null, name: 'My Workspace' }],
  selectedNodeIds: new Set(),
  selectionMode: 'single',
  expandedFolderIds: new Set(),
  isLoading: false,
  error: null,
  activeView: 'workspace',
  // MODUL 69.4: Default sort state — initialized from localStorage
  sortBy: typeof window !== 'undefined' ? getInitialSortPreference().sortBy : 'name',
  sortDirection: typeof window !== 'undefined' ? getInitialSortPreference().sortDirection : 'asc',

  setTree: (nodes) => {
    const flatMap = new Map<string, TreeNode>();
    flattenTree(nodes, flatMap);
    set({ tree: nodes, flatNodes: flatMap });
  },

  setCurrentFolder: (folderId, path) => {
    // 17 — Navigating to a folder always switches to workspace view
    set({ currentFolderId: folderId, currentFolderPath: path, selectedNodeIds: new Set(), activeView: 'workspace' });
  },

  selectNode: (nodeId, mode) => {
    const state = get();
    const selectionMode = mode || state.selectionMode;
    const newSelection = new Set(state.selectedNodeIds);

    if (selectionMode === 'single') {
      newSelection.clear();
      newSelection.add(nodeId);
    } else {
      if (newSelection.has(nodeId)) {
        newSelection.delete(nodeId);
      } else {
        newSelection.add(nodeId);
      }
    }

    set({ selectedNodeIds: newSelection, selectionMode });
  },

  clearSelection: () => set({ selectedNodeIds: new Set() }),

  toggleFolderExpand: (folderId) => {
    const expanded = new Set(get().expandedFolderIds);
    if (expanded.has(folderId)) {
      expanded.delete(folderId);
    } else {
      expanded.add(folderId);
    }
    set({ expandedFolderIds: expanded });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setActiveView: (view) => set({ activeView: view }),

  // MODUL 69.4: Set sort preference — also persist to localStorage
  setSortPreference: (sortBy, sortDirection) => {
    set({ sortBy, sortDirection });
    try {
      localStorage.setItem(SORT_PREF_KEY, JSON.stringify({ sortBy, sortDirection }));
    } catch { /* localStorage not available */ }
  },

  // Optimistic rename — returns old name for rollback
  optimisticRename: (nodeId, newName) => {
    const flatNodes = new Map(get().flatNodes);
    const old = flatNodes.get(nodeId);
    if (!old) return null;

    flatNodes.set(nodeId, { ...old, name: newName });
    set({ flatNodes });

    // Also update in tree
    const tree = get().tree;
    const updatedTree = updateNodeInTree(tree, nodeId, { name: newName });
    set({ tree: updatedTree });

    return old.name;
  },

  rollbackRename: (nodeId, oldName) => {
    const flatNodes = new Map(get().flatNodes);
    const current = flatNodes.get(nodeId);
    if (!current) return;

    flatNodes.set(nodeId, { ...current, name: oldName });
    const tree = get().tree;
    const updatedTree = updateNodeInTree(tree, nodeId, { name: oldName });
    set({ flatNodes, tree: updatedTree });
  },

  optimisticMove: (nodeId, newParentId) => {
    const flatNodes = new Map(get().flatNodes);
    const old = flatNodes.get(nodeId);
    if (!old) return null;

    const oldParentId = old.parentId;
    flatNodes.set(nodeId, { ...old, parentId: newParentId });
    set({ flatNodes });

    // Rebuild tree
    const allNodes = Array.from(flatNodes.values());
    const newTree = buildTree(allNodes);
    set({ tree: newTree });

    return { oldParentId };
  },

  rollbackMove: (nodeId, oldParentId) => {
    const flatNodes = new Map(get().flatNodes);
    const current = flatNodes.get(nodeId);
    if (!current) return;

    flatNodes.set(nodeId, { ...current, parentId: oldParentId });
    const allNodes = Array.from(flatNodes.values());
    const newTree = buildTree(allNodes);
    set({ flatNodes, tree: newTree });
  },

  optimisticDelete: (nodeIds) => {
    const backup = new Map<string, { parentId: string | null }>();
    const flatNodes = new Map(get().flatNodes);

    for (const id of nodeIds) {
      const node = flatNodes.get(id);
      if (node) {
        backup.set(id, { parentId: node.parentId });
        flatNodes.delete(id);
      }
    }

    const allNodes = Array.from(flatNodes.values());
    const newTree = buildTree(allNodes);
    set({ flatNodes, tree: newTree, selectedNodeIds: new Set() });

    return backup;
  },

  rollbackDelete: (deletedNodes) => {
    // This would require re-fetching from server for accurate rollback
    // For simplicity, we just trigger a re-fetch
    set({ error: 'Delete failed, refreshing...' });
  },

  addNode: (node) => {
    const flatNodes = new Map(get().flatNodes);
    flatNodes.set(node.id, node);

    const allNodes = Array.from(flatNodes.values());
    const newTree = buildTree(allNodes);
    set({ flatNodes, tree: newTree });
  },

  removeNode: (nodeId) => {
    const flatNodes = new Map(get().flatNodes);
    flatNodes.delete(nodeId);

    const allNodes = Array.from(flatNodes.values());
    const newTree = buildTree(allNodes);
    set({ flatNodes, tree: newTree, selectedNodeIds: new Set([...get().selectedNodeIds].filter(id => id !== nodeId)) });
  },
}));

// ============================================================
// Helper: Tree Materialization Algorithm
// 4.5 — Adjacency-list-to-tree conversion (client-side)
// ============================================================

export function buildTree(nodes: TreeNode[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  // First pass: create map with empty children
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] });
  }

  // Second pass: build parent-child relationships
  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId)!;
      parent.children.push(treeNode);
    } else {
      rootNodes.push(treeNode);
    }
  }

  // Sort: folders first, then alphabetically
  for (const [, node] of nodeMap) {
    node.children.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  rootNodes.sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  return rootNodes;
}

function flattenTree(nodes: TreeNode[], map: Map<string, TreeNode>) {
  for (const node of nodes) {
    map.set(node.id, node);
    if (node.children) {
      flattenTree(node.children, map);
    }
  }
}

function updateNodeInTree(nodes: TreeNode[], nodeId: string, updates: Partial<TreeNode>): TreeNode[] {
  return nodes.map(node => {
    if (node.id === nodeId) {
      return { ...node, ...updates };
    }
    if (node.children) {
      return { ...node, children: updateNodeInTree(node.children, nodeId, updates) };
    }
    return node;
  });
}
