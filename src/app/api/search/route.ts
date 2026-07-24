// ============================================================
// MODUL 12: Global Search API — LIKE-based search for SQLite
// Searches Node.name and NoteContent.contentJson (extracts plain text)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bigintToNumber } from '@/lib/bigint';

// GET /api/search?q=...&type=...&dateFrom=...&dateTo=...&tags=...&tagMode=AND|OR
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const type = searchParams.get('type') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const tagsParam = searchParams.get('tags') || undefined; // comma-separated tag IDs
    const tagMode = searchParams.get('tagMode') || 'OR'; // "AND" | "OR"

    if (!q || q.trim().length < 1) {
      return NextResponse.json({ success: true, data: { results: [] } });
    }

    const query = q.trim();

    // Build where clause for Node search
    const where: Record<string, unknown> = {
      ownerId: session.user.id,
      deletedAt: null,
    };

    // Type filter
    if (type && ['file', 'folder', 'note'].includes(type)) {
      where.type = type;
    }

    // Date range filter
    if (dateFrom) {
      where.createdAt = { gte: new Date(dateFrom) };
    }
    if (dateTo) {
      // Combine with existing createdAt filter
      if (where.createdAt && typeof where.createdAt === 'object') {
        where.createdAt = { ...where.createdAt, lte: new Date(dateTo) };
      } else {
        where.createdAt = { lte: new Date(dateTo) };
      }
    }

    // 21 — Tag filter: if tags are specified, filter nodes that have matching tags
    let tagFilter: Record<string, unknown> | undefined;
    if (tagsParam) {
      const tagIds = tagsParam.split(',').filter(Boolean);
      if (tagIds.length > 0) {
        if (tagMode === 'AND') {
          // AND mode: node must have ALL specified tags
          // We need to find nodes that have ALL the specified tagIds
          // Get all nodeTag entries for these tagIds
          const nodeTagEntries = await db.nodeTag.findMany({
            where: { tagId: { in: tagIds } },
            select: { nodeId: true, tagId: true },
          });
          // Group by nodeId and check which nodes have ALL tags
          const nodeTagMap = new Map<string, Set<string>>();
          for (const entry of nodeTagEntries) {
            if (!nodeTagMap.has(entry.nodeId)) {
              nodeTagMap.set(entry.nodeId, new Set());
            }
            nodeTagMap.get(entry.nodeId)!.add(entry.tagId);
          }
          const andMatchingNodeIds = Array.from(nodeTagMap.entries())
            .filter(([_, tagSet]) => tagIds.every(tid => tagSet.has(tid)))
            .map(([nodeId]) => nodeId);
          tagFilter = { id: { in: andMatchingNodeIds } };
        } else {
          // OR mode: node must have ANY of the specified tags
          tagFilter = {
            tags: {
              some: { tagId: { in: tagIds } },
            },
          };
        }
      }
    }

    // Build combined where clause with tag filter
    const nameWhere = tagFilter
      ? { ...where, ...tagFilter, name: { contains: query } }
      : { ...where, name: { contains: query } };

    // 12.1 — Search Node table by name using LIKE
    // SQLite LIKE is case-insensitive by default for ASCII chars
    const nameMatches = await db.node.findMany({
      where: nameWhere,
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        metadata: true,
        note: true,
      },
      take: 50,
    });

    // 12.1 — For notes: search NoteContent.contentJson
    // Extract plain text from Tiptap JSON and search with LIKE
    // We'll get all notes for the user and filter in-memory since
    // SQLite can't do JSON text extraction natively in a query
    let contentMatches: Array<Record<string, unknown>> = [];

    // Only search note content if type filter is 'note' or no type filter
    if (!type || type === 'note') {
      const noteWhere: Record<string, unknown> = {
        ownerId: session.user.id,
        deletedAt: null,
        type: 'note',
      };

      if (dateFrom) {
        noteWhere.createdAt = { gte: new Date(dateFrom) };
      }
      if (dateTo) {
        if (noteWhere.createdAt && typeof noteWhere.createdAt === 'object') {
          noteWhere.createdAt = { ...noteWhere.createdAt, lte: new Date(dateTo) };
        } else {
          noteWhere.createdAt = { lte: new Date(dateTo) };
        }
      }

      const allNotes = await db.node.findMany({
        where: noteWhere,
        include: {
          metadata: true,
          note: true,
        },
        orderBy: [{ updatedAt: 'desc' }],
      });

      // Filter notes whose content contains the query text
      contentMatches = allNotes.filter((node) => {
        if (!node.note?.contentJson) return false;
        const plainText = extractPlainTextFromTiptapJson(node.note.contentJson);
        return plainText.toLowerCase().includes(query.toLowerCase());
      });
    }

    // Combine results: name matches + content matches (deduplicate)
    const seenIds = new Set<string>();
    const results: Array<{
      id: string;
      type: string;
      name: string;
      parentId: string | null;
      createdAt: string;
      updatedAt: string;
      snippet: string | null;
      metadata: Record<string, unknown> | null;
    }> = [];

    // Add name matches first (higher relevance)
    for (const node of nameMatches) {
      if (seenIds.has(node.id)) continue;
      seenIds.add(node.id);

      // For name matches, the snippet is just the name itself (highlighted by frontend)
      results.push({
        id: node.id,
        type: node.type,
        name: node.name,
        parentId: node.parentId,
        createdAt: node.createdAt as string,
        updatedAt: node.updatedAt as string,
        snippet: null, // name match, no content snippet needed
        metadata: node.metadata
          ? { ...node.metadata as Record<string, unknown>, sizeBytes: bigintToNumber((node.metadata as Record<string, unknown>).sizeBytes as bigint | number | null) }
          : null,
      });
    }

    // Add content matches (these matched via note content, not name)
    for (const node of contentMatches) {
      if (seenIds.has(node.id)) continue;
      seenIds.add(node.id);

      const plainText = node.note?.contentJson
        ? extractPlainTextFromTiptapJson(node.note.contentJson as string)
        : '';
      const snippet = extractSnippet(plainText, query);

      results.push({
        id: node.id as string,
        type: node.type as string,
        name: node.name as string,
        parentId: node.parentId as string | null,
        createdAt: node.createdAt as string,
        updatedAt: node.updatedAt as string,
        snippet,
        metadata: node.metadata
          ? { ...node.metadata as Record<string, unknown>, sizeBytes: bigintToNumber((node.metadata as Record<string, unknown>).sizeBytes as bigint | number | null) }
          : null,
      });
    }

    // Sort by relevance: name matches first, then content matches, then by updatedAt
    results.sort((a, b) => {
      // Name matches (snippet === null) come first
      if (a.snippet === null && b.snippet !== null) return -1;
      if (a.snippet !== null && b.snippet === null) return 1;
      // Then sort by updatedAt descending
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return NextResponse.json({
      success: true,
      data: {
        results: results.slice(0, 50),
        total: results.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Search failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ============================================================
// Helper: Extract plain text from Tiptap ProseMirror JSON
// Recursively walks the JSON tree and collects all text content
// ============================================================
function extractPlainTextFromTiptapJson(contentJson: string): string {
  try {
    const parsed = JSON.parse(contentJson);
    return extractTextFromNode(parsed);
  } catch {
    // If JSON parse fails, treat as raw text
    return contentJson;
  }
}

function extractTextFromNode(node: Record<string, unknown>): string {
  if (!node) return '';

  // If this is a text node, return its text content
  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }

  // If this node has content (children), recursively extract text
  const content = node.content;
  if (Array.isArray(content)) {
    return content
      .map((child: Record<string, unknown>) => extractTextFromNode(child))
      .join(' ');
  }

  return '';
}

// ============================================================
// Helper: Extract a snippet around the match for display
// Shows ~60 chars around the first match occurrence
// ============================================================
function extractSnippet(text: string, query: string): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) return text.slice(0, 80);

  // Show ~30 chars before and ~30 chars after the match
  const start = Math.max(0, matchIndex - 30);
  const end = Math.min(text.length, matchIndex + query.length + 30);

  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}
