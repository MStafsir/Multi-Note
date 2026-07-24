// ============================================================
// Unit Tests — Zod Validators
// Tests all validators: valid inputs pass, invalid inputs fail
// Edge cases: empty strings, too long names, invalid emails, short passwords
// Target: ≥80% coverage for /lib/validators
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  createNodeSchema,
  updateNodeSchema,
  tagSchema,
  createFolderSchema,
  renameNodeSchema,
  deleteNodeSchema,
  moveNodeSchema,
  uploadRequestSchema,
  noteContentSchema,
  searchSchema,
  createShareSchema,
  sharePermissionSchema,
  nodeTypeSchema,
} from '@/lib/validators';

// --- registerSchema ---
describe('registerSchema', () => {
  it('validates correct registration data', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'secure123',
      name: 'John Doe',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
      expect(result.data.password).toBe('secure123');
      expect(result.data.name).toBe('John Doe');
    }
  });

  it('validates registration without name (optional)', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'secure123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBeUndefined();
    }
  });

  it('rejects invalid email format', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'secure123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailError = result.error.issues.find(i => i.path[0] === 'email');
      expect(emailError?.message).toBe('Invalid email format');
    }
  });

  it('rejects empty email string', () => {
    const result = registerSchema.safeParse({
      email: '',
      password: 'secure123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 6 characters', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'abc12',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwError = result.error.issues.find(i => i.path[0] === 'password');
      expect(pwError?.message).toContain('at least 6');
    }
  });

  it('rejects password too long (>128 chars)', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'a'.repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it('rejects name too long (>100 chars)', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'secure123',
      name: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = registerSchema.safeParse({
      password: 'secure123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing password', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('accepts various valid email formats', () => {
    const emails = ['a@b.co', 'user+tag@domain.com', 'test_name@sub.domain.org'];
    for (const email of emails) {
      const result = registerSchema.safeParse({
        email,
        password: 'secure123',
      });
      expect(result.success).toBe(true);
    }
  });
});

// --- loginSchema ---
describe('loginSchema', () => {
  it('validates correct login data', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'anypassword',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'bad-email',
      password: 'anypassword',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

// --- createNodeSchema ---
describe('createNodeSchema', () => {
  it('validates creating a folder node', () => {
    const result = createNodeSchema.safeParse({
      name: 'My Folder',
      type: 'folder',
      parentId: null,
    });
    expect(result.success).toBe(true);
  });

  it('validates creating a note node', () => {
    const result = createNodeSchema.safeParse({
      name: 'My Note',
      type: 'note',
    });
    expect(result.success).toBe(true);
  });

  it('validates creating a file node', () => {
    const result = createNodeSchema.safeParse({
      name: 'document.pdf',
      type: 'file',
      parentId: 'some-parent-id',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createNodeSchema.safeParse({
      name: '',
      type: 'folder',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find(i => i.path[0] === 'name');
      expect(nameError?.message).toBe('Name is required');
    }
  });

  it('rejects name too long (>100 chars)', () => {
    const result = createNodeSchema.safeParse({
      name: 'a'.repeat(101),
      type: 'folder',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find(i => i.path[0] === 'name');
      expect(nameError?.message).toBe('Name too long');
    }
  });

  it('rejects invalid node type', () => {
    const result = createNodeSchema.safeParse({
      name: 'Test',
      type: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = createNodeSchema.safeParse({
      type: 'folder',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing type', () => {
    const result = createNodeSchema.safeParse({
      name: 'Test',
    });
    expect(result.success).toBe(false);
  });
});

// --- updateNodeSchema ---
describe('updateNodeSchema', () => {
  it('validates updating name only', () => {
    const result = updateNodeSchema.safeParse({
      name: 'New Name',
    });
    expect(result.success).toBe(true);
  });

  it('validates updating contentJson only', () => {
    const result = updateNodeSchema.safeParse({
      contentJson: '{"type":"doc"}',
    });
    expect(result.success).toBe(true);
  });

  it('validates updating both name and content', () => {
    const result = updateNodeSchema.safeParse({
      name: 'New Name',
      contentJson: '{"type":"doc"}',
    });
    expect(result.success).toBe(true);
  });

  it('validates empty object (both optional)', () => {
    const result = updateNodeSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects empty name string', () => {
    const result = updateNodeSchema.safeParse({
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty contentJson string', () => {
    const result = updateNodeSchema.safeParse({
      contentJson: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name too long (>100 chars)', () => {
    const result = updateNodeSchema.safeParse({
      name: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

// --- tagSchema ---
describe('tagSchema', () => {
  it('validates tag with name only (default color)', () => {
    const result = tagSchema.safeParse({
      name: 'Important',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.colorHex).toBe('#6B7280'); // default
    }
  });

  it('validates tag with custom color', () => {
    const result = tagSchema.safeParse({
      name: 'Urgent',
      colorHex: '#FF0000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.colorHex).toBe('#FF0000');
    }
  });

  it('validates lowercase hex color', () => {
    const result = tagSchema.safeParse({
      name: 'Tag',
      colorHex: '#ff00aa',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty tag name', () => {
    const result = tagSchema.safeParse({
      name: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find(i => i.path[0] === 'name');
      expect(nameError?.message).toBe('Tag name is required');
    }
  });

  it('rejects tag name too long (>50 chars)', () => {
    const result = tagSchema.safeParse({
      name: 'a'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid hex color format', () => {
    const invalidColors = ['red', '#FFF', '#ffffff00', '123456', '#12'];
    for (const color of invalidColors) {
      const result = tagSchema.safeParse({
        name: 'Tag',
        colorHex: color,
      });
      expect(result.success).toBe(false);
    }
  });

  it('rejects missing tag name', () => {
    const result = tagSchema.safeParse({
      colorHex: '#FF0000',
    });
    expect(result.success).toBe(false);
  });
});

// --- createFolderSchema ---
describe('createFolderSchema', () => {
  it('validates correct folder creation', () => {
    const result = createFolderSchema.safeParse({
      name: 'Documents',
      parentId: 'parent-id',
    });
    expect(result.success).toBe(true);
  });

  it('validates root folder (no parentId)', () => {
    const result = createFolderSchema.safeParse({
      name: 'Root Folder',
    });
    expect(result.success).toBe(true);
  });

  it('validates root folder with null parentId', () => {
    const result = createFolderSchema.safeParse({
      name: 'Root Folder',
      parentId: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createFolderSchema.safeParse({
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name too long (>255)', () => {
    const result = createFolderSchema.safeParse({
      name: 'a'.repeat(256),
    });
    expect(result.success).toBe(false);
  });
});

// --- renameNodeSchema ---
describe('renameNodeSchema', () => {
  it('validates correct rename', () => {
    const result = renameNodeSchema.safeParse({
      nodeId: 'node-123',
      newName: 'New Name',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty nodeId', () => {
    const result = renameNodeSchema.safeParse({
      nodeId: '',
      newName: 'New Name',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty newName', () => {
    const result = renameNodeSchema.safeParse({
      nodeId: 'node-123',
      newName: '',
    });
    expect(result.success).toBe(false);
  });
});

// --- deleteNodeSchema ---
describe('deleteNodeSchema', () => {
  it('validates correct deletion', () => {
    const result = deleteNodeSchema.safeParse({
      nodeId: 'node-123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty nodeId', () => {
    const result = deleteNodeSchema.safeParse({
      nodeId: '',
    });
    expect(result.success).toBe(false);
  });
});

// --- moveNodeSchema ---
describe('moveNodeSchema', () => {
  it('validates moving to a new parent', () => {
    const result = moveNodeSchema.safeParse({
      nodeId: 'node-123',
      newParentId: 'parent-456',
    });
    expect(result.success).toBe(true);
  });

  it('validates moving to root (null parent)', () => {
    const result = moveNodeSchema.safeParse({
      nodeId: 'node-123',
      newParentId: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty nodeId', () => {
    const result = moveNodeSchema.safeParse({
      nodeId: '',
      newParentId: null,
    });
    expect(result.success).toBe(false);
  });
});

// --- uploadRequestSchema ---
describe('uploadRequestSchema', () => {
  it('validates correct upload request', () => {
    const result = uploadRequestSchema.safeParse({
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      parentId: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects file exceeding 500MB limit', () => {
    const result = uploadRequestSchema.safeParse({
      fileName: 'huge.bin',
      mimeType: 'application/octet-stream',
      sizeBytes: 501 * 1024 * 1024,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative size', () => {
    const result = uploadRequestSchema.safeParse({
      fileName: 'test.txt',
      mimeType: 'text/plain',
      sizeBytes: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty file name', () => {
    const result = uploadRequestSchema.safeParse({
      fileName: '',
      mimeType: 'text/plain',
      sizeBytes: 100,
    });
    expect(result.success).toBe(false);
  });
});

// --- noteContentSchema ---
describe('noteContentSchema', () => {
  it('validates correct note content', () => {
    const result = noteContentSchema.safeParse({
      nodeId: 'note-123',
      contentJson: '{"type":"doc"}',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty nodeId', () => {
    const result = noteContentSchema.safeParse({
      nodeId: '',
      contentJson: '{"type":"doc"}',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty contentJson', () => {
    const result = noteContentSchema.safeParse({
      nodeId: 'note-123',
      contentJson: '',
    });
    expect(result.success).toBe(false);
  });
});

// --- searchSchema ---
describe('searchSchema', () => {
  it('validates search with query only', () => {
    const result = searchSchema.safeParse({
      query: 'test search',
    });
    expect(result.success).toBe(true);
  });

  it('validates search with type filter', () => {
    const result = searchSchema.safeParse({
      query: 'test',
      type: 'folder',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty query', () => {
    const result = searchSchema.safeParse({
      query: '',
    });
    expect(result.success).toBe(false);
  });
});

// --- createShareSchema ---
describe('createShareSchema', () => {
  it('validates sharing with generateLink default', () => {
    const result = createShareSchema.safeParse({
      nodeId: 'node-123',
      permissionLevel: 'view',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generateLink).toBe(false); // default
    }
  });

  it('validates sharing with public link', () => {
    const result = createShareSchema.safeParse({
      nodeId: 'node-123',
      permissionLevel: 'edit',
      generateLink: true,
      linkType: 'public',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid permission level', () => {
    const result = createShareSchema.safeParse({
      nodeId: 'node-123',
      permissionLevel: 'admin',
    });
    expect(result.success).toBe(false);
  });
});

// --- sharePermissionSchema ---
describe('sharePermissionSchema', () => {
  it('accepts valid permission levels', () => {
    for (const level of ['view', 'comment', 'edit']) {
      const result = sharePermissionSchema.safeParse(level);
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid permission level', () => {
    const result = sharePermissionSchema.safeParse('admin');
    expect(result.success).toBe(false);
  });
});

// --- nodeTypeSchema ---
describe('nodeTypeSchema', () => {
  it('accepts valid node types', () => {
    for (const type of ['file', 'folder', 'note']) {
      const result = nodeTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid node type', () => {
    const result = nodeTypeSchema.safeParse('image');
    expect(result.success).toBe(false);
  });
});
