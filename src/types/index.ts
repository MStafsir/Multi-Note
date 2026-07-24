// ============================================================
// MODUL 1: Type Contract Lock — Single Source of Truth
// [STACK CHANGE FLAG] required to modify these types
// ============================================================

// 1.3 — Discriminated union: single source of truth for entity types
export type NodeType = 'file' | 'folder' | 'note';

// 1.2 — Union type absolut untuk entity, LOCKED
// Cannot be extended without [STACK CHANGE FLAG]
export type FileSystemNode = FileNode | FolderNode | NoteNode;

export interface FileNode {
  id: string;
  type: 'file';
  name: string;
  parentId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  metadata?: FileMetadata;
}

export interface FolderNode {
  id: string;
  type: 'folder';
  name: string;
  parentId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  children?: FileSystemNode[];
}

export interface NoteNode {
  id: string;
  type: 'note';
  name: string;
  parentId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  content?: NoteContent;
}

// 2.6 — File metadata separate table
export interface FileMetadata {
  nodeId: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string | null;
}

// 2.7 — Note content stored as Tiptap JSON schema
export interface NoteContent {
  nodeId: string;
  contentJson: string;
}

// Discriminator helper — type-safe narrowing
export function isFileNode(node: FileSystemNode): node is FileNode {
  return node.type === 'file';
}
export function isFolderNode(node: FileSystemNode): node is FolderNode {
  return node.type === 'folder';
}
export function isNoteNode(node: FileSystemNode): node is NoteNode {
  return node.type === 'note';
}

// Tree materialization types
export interface TreeNode {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;
  children: TreeNode[];
  metadata?: FileMetadata;
  content?: NoteContent;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Upload progress types
export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

// Storage quota types
export interface StorageQuota {
  usedBytes: number;
  limitBytes: number;
  percentage: number;
}

// Auth Types
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

// Selection state types
export type SelectionMode = 'single' | 'multi';

// ============================================================
// MODUL 11: Calculator Widget — Types
// ============================================================

export type CalcMode = 'basic' | 'scientific' | 'unit';

export interface CalcHistoryItem {
  id?: string;
  expression: string;
  result: string;
  mode: CalcMode;
  createdAt?: string;
}

export interface CalculatorState {
  isOpen: boolean;
  mode: CalcMode;
  expression: string;
  result: string | null;
  error: string | null;
  history: CalcHistoryItem[];
}

// --- Modul 13: Sharing & Permission Types ---
export type SharePermission = 'view' | 'comment' | 'edit';
export type ShareLinkType = 'public' | 'private';

export interface NodeShareInfo {
  id: string;
  nodeId: string;
  sharedWithUserId: string | null;
  permissionLevel: SharePermission;
  shareLinkToken: string | null;
  shareLinkExpiry: string | null;
  linkType: ShareLinkType | null;
  createdAt: string;
  // Computed fields for display
  sharedWithEmail?: string | null;
  sharedWithName?: string | null;
}

export interface ShareLink {
  token: string;
  nodeId: string;
  nodeName: string;
  permissionLevel: SharePermission;
  linkType: ShareLinkType;
  expiry: string | null;
}

export interface ShareLinkAccessData {
  nodeId: string;
  nodeType: 'file' | 'folder' | 'note';
  nodeName: string;
  permissionLevel: SharePermission;
  isReadOnly?: boolean;
  content?: string | null;
  metadata?: FileMetadata | null;
  children?: Array<{ id: string; name: string; type: string }>;
}

// --- Modul 15: File Version History Types ---
export interface FileVersionInfo {
  id: string;
  versionNumber: number;
  sizeBytes: number | null;
  createdAt: string;
  checksumSha256: string | null;
}

export interface FileVersionListData {
  versions: FileVersionInfo[];
  totalSizeBytes: number;
}

// --- Modul 16: Note Revision History Types ---
export type RevisionTriggerType = 'autosave' | 'manual' | 'restore';

export interface NoteRevisionInfo {
  id: string;
  revisionNumber: number;
  triggerType: RevisionTriggerType;
  createdAt: string;
}

export interface NoteRevisionListData {
  revisions: NoteRevisionInfo[];
}

// --- Diff Types (shared by Modul 15 & 16) ---
export type DiffLineType = 'add' | 'remove' | 'same';

export interface DiffLine {
  type: DiffLineType;
  content: string;
}

export interface DiffData {
  diff: DiffLine[];
}

// --- Modul 21: Tagging, Favorites & Custom Metadata Types ---
export interface TagInfo {
  id: string;
  name: string;
  colorHex: string;
}

export interface NodeTagInfo {
  tagId: string;
  nodeId: string;
  tag?: TagInfo;
}

// --- Modul 22: Undo Stack & Command Palette Types ---
export type UndoActionType = 'rename' | 'move' | 'delete' | 'create' | 'favorite_toggle';

export interface UndoAction {
  id: string;
  type: UndoActionType;
  description: string;
  timestamp: number;
  undoData: Record<string, unknown>;
}

export interface KeyboardShortcut {
  key: string;
  label: string;
  category: 'navigation' | 'creation' | 'editing' | 'tools';
  description: string;
  macLabel?: string; // Display label for Mac (e.g., ⌘ instead of Ctrl)
}
