// ============================================================
// Zod Schema Validation — Server-side payload validation
// All CRUD operations must pass through these validators
// ============================================================

import { z } from 'zod';

// --- Node Type Validation ---
export const nodeTypeSchema = z.enum(['file', 'folder', 'note']);

// --- Folder CRUD Validators (Modul 4) ---
export const createFolderSchema = z.object({
  parentId: z.string().nullable().optional(),
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
});

export const renameNodeSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
  newName: z.string().min(1, 'Name is required').max(255, 'Name too long'),
});

export const deleteNodeSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
});

export const moveNodeSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
  newParentId: z.string().nullable(),
});

// --- File Upload Validators (Modul 5) ---
export const uploadRequestSchema = z.object({
  fileName: z.string().min(1, 'File name required').max(255, 'File name too long'),
  mimeType: z.string().min(1, 'MIME type required'),
  sizeBytes: z.number().min(0, 'Size must be positive').max(500 * 1024 * 1024, 'File exceeds 500MB limit'),
  parentId: z.string().nullable().optional(),
  checksumSha256: z.string().optional(),
});

export const uploadConfirmSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
  storagePath: z.string().min(1, 'Storage path is required'),
});

// --- Auth Validators (Modul 3) ---
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password too long'),
  name: z.string().max(100, 'Name too long').optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// --- Get Folder Tree Query ---
export const getFolderTreeSchema = z.object({
  parentId: z.string().nullable().optional(),
  includeDeleted: z.boolean().default(false),
});

// --- Note Content Validator ---
export const noteContentSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
  contentJson: z.string().min(1, 'Content is required'),
});

// --- Search Validator (Modul 12) ---
export const searchSchema = z.object({
  query: z.string().min(1, 'Search query required'),
  type: nodeTypeSchema.optional(),
  dateFrom: z.string().optional(), // ISO date string for createdAt filter
  dateTo: z.string().optional(),   // ISO date string for createdAt filter
});

// --- Modul 13: Sharing Validators ---
export const sharePermissionSchema = z.enum(['view', 'comment', 'edit']);
export const shareLinkTypeSchema = z.enum(['public', 'private']);

export const createShareSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
  sharedWithUserId: z.string().nullable().optional(), // null for public link
  permissionLevel: sharePermissionSchema,
  generateLink: z.boolean().default(false),
  linkType: shareLinkTypeSchema.optional(), // only for generateLink
  expiryHours: z.number().min(1).max(8760).optional(), // 1h to 1y
});

export const updateShareSchema = z.object({
  permissionLevel: sharePermissionSchema.optional(),
  shareLinkExpiry: z.string().nullable().optional(), // ISO datetime string
  linkType: shareLinkTypeSchema.optional(),
});

export const listSharesSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
});

// --- Modul 15: File Version Validators ---
export const restoreFileVersionSchema = z.object({
  versionId: z.string().min(1, 'Version ID is required'),
});

// --- Modul 16: Note Revision Validators ---
export const restoreNoteRevisionSchema = z.object({
  revisionId: z.string().min(1, 'Revision ID is required'),
});

// --- Modul 30: Additional Validators for Testing Coverage ---
export const createNodeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  type: nodeTypeSchema,
  parentId: z.string().nullable().optional(),
});

export const updateNodeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  contentJson: z.string().min(1, 'Content is required').optional(),
});

export const tagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50, 'Tag name too long'),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').default('#6B7280'),
});

// ============================================================
// MODUL 31: Database Block Validators
// ============================================================

export const propertyTypeSchema = z.enum([
  'text', 'number', 'select', 'multi_select', 'date', 'checkbox',
  'url', 'person', 'relation', 'formula', 'rollup', 'created_time', 'created_by',
]);

export const columnSchemaValidator = z.object({
  column_id: z.string().min(1),
  name: z.string().min(1).max(100),
  type: propertyTypeSchema,
  config: z.object({
    options: z.array(z.object({ id: z.string(), name: z.string(), colorHex: z.string() })).optional(),
    relationDatabaseId: z.string().optional(),
    rollupColumnId: z.string().optional(),
    rollupAggregation: z.enum(['sum', 'count', 'average', 'min', 'max']).optional(),
    formulaExpression: z.string().optional(),
    dateFormat: z.string().optional(),
  }).optional(),
});

export const createDatabaseSchema = z.object({
  parentNoteId: z.string().min(1, 'Parent note ID is required'),
  title: z.string().min(1).max(200).default('Untitled Database'),
  schema: z.array(columnSchemaValidator).min(1, 'At least one column required'),
});

export const updateDatabaseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  schema: z.array(columnSchemaValidator).optional(),
});

export const createRowSchema = z.object({
  databaseId: z.string().min(1, 'Database ID is required'),
  cellData: z.record(z.unknown()).default({}), // validated dynamically against schema
});

export const updateRowSchema = z.object({
  cellData: z.record(z.unknown()), // validated dynamically against schema
});

// ============================================================
// MODUL 32: Database View Validators
// ============================================================

export const databaseViewTypeSchema = z.enum(['table', 'board', 'list', 'gallery']);

export const filterOperatorSchema = z.enum([
  'equals', 'not_equals', 'contains', 'not_contains',
  'greater_than', 'less_than', 'is_empty', 'is_not_empty',
  'before', 'after', 'on_or_before', 'on_or_after',
]);

export const filterConditionSchema = z.object({
  columnId: z.string().min(1),
  operator: filterOperatorSchema,
  value: z.unknown().optional(),
});

export const filterGroupSchema: z.ZodType<import('@/types').FilterGroup> = z.object({
  type: z.enum(['and', 'or']),
  conditions: z.array(filterConditionSchema),
  groups: z.lazy(() => z.array(filterGroupSchema)).optional(),
});

export const sortDefinitionSchema = z.object({
  columnId: z.string().min(1),
  direction: z.enum(['asc', 'desc']),
});

export const databaseViewConfigSchema = z.object({
  filters: filterGroupSchema.optional(),
  sorts: z.array(sortDefinitionSchema).optional(),
  groupBy: z.string().optional(),
  fieldOrder: z.array(z.string()).optional(),
  hiddenFields: z.array(z.string()).optional(),
  galleryCoverColumnId: z.string().optional(),
});

export const createDatabaseViewSchema = z.object({
  databaseId: z.string().min(1),
  type: databaseViewTypeSchema,
  name: z.string().min(1).max(200).default('New View'),
  config: databaseViewConfigSchema.optional(),
});

export const updateDatabaseViewSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: databaseViewTypeSchema.optional(),
  config: databaseViewConfigSchema.optional(),
});

// ============================================================
// MODUL 33: Note Template Validators
// ============================================================

export const templateCategorySchema = z.enum([
  'meeting_notes', 'project_plan', 'journal', 'weekly_review', 'blank', 'custom',
]);

export const createTemplateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  contentJsonTemplate: z.string().min(1, 'Template content is required'),
  category: templateCategorySchema,
});

export const updateTemplateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  contentJsonTemplate: z.string().min(1).optional(),
  category: templateCategorySchema.optional(),
});

export const duplicateNoteSchema = z.object({
  nodeId: z.string().min(1, 'Node ID to duplicate is required'),
  copyDatabaseData: z.boolean().default(false), // 33.5 — toggle: copy schema+data vs schema only
  stripEmbeddedFiles: z.boolean().default(false), // 33.4 — toggle: strip embedded file references
});

export const saveAsTemplateSchema = z.object({
  nodeId: z.string().min(1, 'Source note ID is required'),
  title: z.string().min(1).max(200),
  category: templateCategorySchema.default('custom'),
  stripEmbeddedFiles: z.boolean().default(false),
});

// ============================================================
// MODUL 34: Note Link Validators
// ============================================================

export const noteLinkSchema = z.object({
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
});

// ============================================================
// MODUL 35: Comment Validators
// ============================================================

export const createCommentSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
  content: z.string().min(1, 'Comment content is required').max(2000, 'Comment too long'),
  parentCommentId: z.string().nullable().optional(), // null = root comment
  anchorPosition: z.object({
    from: z.number().min(0),
    to: z.number().min(0),
    text: z.string(),
    path: z.array(z.number()),
  }).nullable().optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  resolvedAt: z.string().nullable().optional(), // toggle resolve/unresolve
});
