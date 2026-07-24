// ============================================================
// MODUL 15.5: File Version Diff Preview
// GET — Diff between a specific version and current version
// For text files only (txt/md/json/csv)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readFile } from 'fs/promises';
import path from 'path';

// Supported text file extensions for diff
const TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.csv', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.log', '.py', '.rb', '.sh', '.bat'];

// Simple line diff algorithm (LCS-based)
function computeLineDiff(oldLines: string[], newLines: string[]): { type: 'add' | 'remove' | 'same'; content: string }[] {
  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;

  // Create DP table for LCS lengths
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  const result: { type: 'add' | 'remove' | 'same'; content: string }[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'same', content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', content: newLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'remove', content: oldLines[i - 1] });
      i--;
    }
  }

  return result;
}

// GET /api/nodes/[id]/versions/[versionId]/diff — Diff preview for text files
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, versionId } = await params;

    // Check node exists and user owns it
    const node = await db.node.findUnique({
      where: { id },
      include: { metadata: true },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    if (node.type !== 'file') {
      return NextResponse.json({ success: false, error: 'Node is not a file' }, { status: 400 });
    }

    if (node.ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Check if file is a text file type
    const ext = path.extname(node.name).toLowerCase();
    if (!TEXT_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { success: false, error: 'Diff not supported for this file type' },
        { status: 400 }
      );
    }

    // Find the specific version
    const version = await db.fileVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.nodeId !== id) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 });
    }

    // Read the old version's file content
    const oldFilePath = path.join(process.cwd(), 'download', version.storagePath);
    const oldContent = await readFile(oldFilePath, 'utf-8');

    // Read the current version's file content
    if (!node.metadata?.storagePath) {
      return NextResponse.json({ success: false, error: 'Current file metadata not found' }, { status: 404 });
    }

    const currentFilePath = path.join(process.cwd(), 'download', node.metadata.storagePath);
    const currentContent = await readFile(currentFilePath, 'utf-8');

    // Compute line diff
    const oldLines = oldContent.split('\n');
    const newLines = currentContent.split('\n');
    const diffResult = computeLineDiff(oldLines, newLines);

    return NextResponse.json({
      success: true,
      data: {
        versionId: version.id,
        versionNumber: version.versionNumber,
        currentStoragePath: node.metadata.storagePath,
        lines: diffResult,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Diff computation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
