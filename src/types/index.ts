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

// ============================================================
// MODUL 31: Database Block — Schema & Property Type Engine
// ============================================================

// 31.3 — Property type enum (NOT a new NodeType — DatabaseBlock is Tiptap custom node)
export type PropertyType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'checkbox'
  | 'url'
  | 'person'
  | 'relation'
  | 'formula'
  | 'rollup'
  | 'created_time'
  | 'created_by';

// 31.2 — Column schema definition
export interface ColumnSchema {
  column_id: string;
  name: string;
  type: PropertyType;
  config?: ColumnConfig;
}

// Column config varies by property type
export interface ColumnConfig {
  options?: SelectOption[];        // for select/multi_select
  relationDatabaseId?: string;     // for relation — FK to another note_databases
  rollupColumnId?: string;         // for rollup — which column to aggregate
  rollupAggregation?: 'sum' | 'count' | 'average' | 'min' | 'max'; // for rollup
  formulaExpression?: string;      // for formula — mathjs expression with prop("ColumnName")
  dateFormat?: string;             // for date display format
}

export interface SelectOption {
  id: string;
  name: string;
  colorHex: string;
}

// 31.2 — Database info (note_databases table)
export interface NoteDatabaseInfo {
  id: string;
  parentNoteId: string;
  title: string;
  schema: ColumnSchema[];
  createdAt: string;
  updatedAt: string;
}

// 31.4 — Row data (database_rows table)
export interface DatabaseRowInfo {
  id: string;
  databaseId: string;
  cellData: Record<string, CellValue>;
  createdAt: string;
  updatedAt: string;
}

// Cell value type — varies by property type
export type CellValue =
  | string      // text, url, select (option id), person (user id), created_by
  | number      // number, formula, rollup result
  | boolean     // checkbox
  | string[]    // multi_select (array of option ids)
  | null;       // empty cell

// ============================================================
// MODUL 32: Database View — Rendering, Filter, Sort & Layout
// ============================================================

// 32.1 — View type enum
export type DatabaseViewType = 'table' | 'board' | 'list' | 'gallery';

// 32.2 — Filter condition
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'before'
  | 'after'
  | 'on_or_before'
  | 'on_or_after';

export interface FilterCondition {
  columnId: string;
  operator: FilterOperator;
  value?: CellValue;
}

export interface FilterGroup {
  type: 'and' | 'or';
  conditions: FilterCondition[];
  groups?: FilterGroup[];
}

// 32.3 — Sort definition
export interface SortDefinition {
  columnId: string;
  direction: 'asc' | 'desc';
}

// 32.1 — Database view info
export interface DatabaseViewInfo {
  id: string;
  databaseId: string;
  type: DatabaseViewType;
  name: string;
  config: DatabaseViewConfig;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseViewConfig {
  filters?: FilterGroup;
  sorts?: SortDefinition[];
  groupBy?: string;       // column_id for board view grouping
  fieldOrder?: string[];  // column_id order for display
  hiddenFields?: string[]; // column_ids hidden in this view
  galleryCoverColumnId?: string; // column_id to use as cover in gallery view
}

// ============================================================
// MODUL 33: Note Template & Duplication System
// ============================================================

// 33.1 — Template category enum
export type TemplateCategory =
  | 'meeting_notes'
  | 'project_plan'
  | 'journal'
  | 'weekly_review'
  | 'blank'
  | 'custom';

// 33.1 — Note template info
export interface NoteTemplateInfo {
  id: string;
  ownerId: string | null; // null = system built-in template
  title: string;
  contentJsonTemplate: string;
  category: TemplateCategory;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// MODUL 34: Backlink & Bi-directional Note-Linking Graph
// ============================================================

// 34.2 — Note link info (note_links table)
export interface NoteLinkInfo {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  createdAt: string;
}

// 34.3 — Backlink with context snippet
export interface BacklinkInfo {
  sourceNodeId: string;
  sourceNodeName: string;
  contextSnippet: string; // sentence context around the link
  createdAt: string;
}

// 34.5 — Graph node for force-directed visualization
export interface GraphNode {
  id: string;
  name: string;
  backlinkCount: number;
}

// 34.5 — Graph edge for force-directed visualization
export interface GraphEdge {
  source: string;
  target: string;
}

// ============================================================
// MODUL 35: In-Note Threaded Commenting System
// ============================================================

// 35.1 — Comment info
export interface CommentInfo {
  id: string;
  nodeId: string;
  parentCommentId: string | null;
  authorId: string;
  authorName?: string;
  authorEmail?: string;
  content: string;
  anchorPosition: AnchorPosition | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// 35.2 — Anchor position using ProseMirror mapping/transform
export interface AnchorPosition {
  from: number;
  to: number;
  text: string;     // the selected text that was anchored
  path: number[];   // path to the node in ProseMirror doc tree
}

// 35.3 — Threaded comment display (flattened: reply-to-reply → same thread)
export interface CommentThread {
  root: CommentInfo;
  replies: CommentInfo[];
}
