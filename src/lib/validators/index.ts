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
