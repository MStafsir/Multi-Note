// ============================================================
// MODUL 16.3: Note Revision Diff
// GET — Diff between two revisions (Myers algorithm)
// Converts contentJson snapshots to plain text for comparison
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkNodeAccess } from '@/lib/permissions';

/**
 * Convert Tiptap ProseMirror JSON content to plain text representation.
 * Extracts text from paragraphs, headings, lists, etc.
 */
function proseMirrorToText(contentJson: string): string {
  try {
    const parsed = JSON.parse(contentJson);

    if (!parsed || !parsed.content) {
      return '';
    }

    const lines: string[] = [];

    function extractText(node: Record<string, unknown>): void {
      // Direct text node
      if (node.type === 'text' && node.text) {
        lines.push(String(node.text));
        return;
      }

      // Content node with children
      if (node.content && Array.isArray(node.content)) {
        for (const child of node.content) {
          extractText(child as Record<string, unknown>);
        }
        // Add paragraph break after block-level nodes
        if (
          node.type === 'paragraph' ||
          node.type === 'heading' ||
          node.type === 'bulletList' ||
          node.type === 'orderedList' ||
          node.type === 'blockquote' ||
          node.type === 'codeBlock'
        ) {
          lines.push('');
        }
      }

      // Handle marks (bold, italic, etc.) — just extract the text
      if (node.marks && Array.isArray(node.marks) && node.text) {
        lines.push(String(node.text));
      }
    }

    for (const topNode of parsed.content) {
      extractText(topNode as Record<string, unknown>);
    }

    return lines.join('\n').trim();
  } catch {
    // If JSON parse fails, return raw string
    return contentJson;
  }
}

/**
 * Myers diff algorithm implementation (word/paragraph-based).
 * Computes the minimum edit script to transform old text into new text.
 */
function myersDiff(oldWords: string[], newWords: string[]): { type: 'add' | 'remove' | 'same'; content: string }[] {
  const n = oldWords.length;
  const m = newWords.length;

  if (n === 0) {
    return newWords.map(w => ({ type: 'add', content: w }));
  }
  if (m === 0) {
    return oldWords.map(w => ({ type: 'remove', content: w }));
  }

  // Build LCS DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: { type: 'add' | 'remove' | 'same'; content: string }[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ type: 'same', content: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', content: newWords[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'remove', content: oldWords[i - 1] });
      i--;
    }
  }

  return result;
}

// GET /api/nodes/[id]/revisions/[revisionId]/diff — Diff between two revisions
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, revisionId } = await params;

    // Get compareWith from query params
    const url = new URL(request.url);
    const compareWith = url.searchParams.get('compareWith');

    if (!compareWith) {
      return NextResponse.json(
        { success: false, error: 'compareWith query parameter is required' },
        { status: 400 }
      );
    }

    // Check node exists
    const node = await db.node.findUnique({
      where: { id },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    if (node.type !== 'note') {
      return NextResponse.json({ success: false, error: 'Node is not a note' }, { status: 400 });
    }

    // Check user owns or has access to the note
    const accessResult = await checkNodeAccess(userId, id, 'view');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Find both revisions
    const revisionA = await db.noteRevision.findUnique({
      where: { id: revisionId },
    });

    const revisionB = await db.noteRevision.findUnique({
      where: { id: compareWith },
    });

    if (!revisionA || revisionA.nodeId !== id) {
      return NextResponse.json({ success: false, error: 'Revision not found' }, { status: 404 });
    }

    if (!revisionB || revisionB.nodeId !== id) {
      return NextResponse.json({ success: false, error: 'Compare-with revision not found' }, { status: 404 });
    }

    // Convert both contentJson snapshots to plain text
    const textA = proseMirrorToText(revisionA.contentJsonSnapshot);
    const textB = proseMirrorToText(revisionB.contentJsonSnapshot);

    // Split text into words/paragraphs for comparison
    // Use paragraph-level splitting for better readability
    const wordsA = textA.split(/\n+/).filter(w => w.length > 0);
    const wordsB = textB.split(/\n+/).filter(w => w.length > 0);

    // Compute diff using Myers algorithm
    const diffResult = myersDiff(wordsA, wordsB);

    return NextResponse.json({
      success: true,
      data: {
        revisionA: {
          id: revisionA.id,
          revisionNumber: revisionA.revisionNumber,
          triggerType: revisionA.triggerType,
          createdAt: revisionA.createdAt,
        },
        revisionB: {
          id: revisionB.id,
          revisionNumber: revisionB.revisionNumber,
          triggerType: revisionB.triggerType,
          createdAt: revisionB.createdAt,
        },
        diff: diffResult,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Diff computation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
