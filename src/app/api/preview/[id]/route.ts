// ============================================================
// MODUL 50-51: Preview Route — slimmed down
// Only serves two content types that are NOT binary streams:
//   1. Text/code (UTF-8 text endpoint for Tier 1 text preview)
//   2. PPTX (server-side JSON for Tier 3 PresentationPreview)
//
// Binary content (image, video, audio, PDF, DOCX, XLSX raw bytes)
// is now served by GET /api/files/[nodeId]/content (authenticated
// streaming with Range header support).
//
// DOCX/XLSX rendering is client-side (docx-preview + SheetJS).
//
// Auth: middleware-injected x-user-id header
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkNodeAccess } from '@/lib/permissions';
import { readFile } from 'fs/promises';
import { getMimePreviewType } from '@/lib/mime-icons';
import { resolveStoragePath } from '@/lib/storage-path';
import { bigintToNumber } from '@/lib/bigint';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const node = await db.node.findUnique({
      where: { id },
      include: { metadata: true },
    });

    if (!node || node.type !== 'file' || node.deletedAt) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    const accessResult = await checkNodeAccess(userId, id, 'view');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    if (!node.metadata) {
      return NextResponse.json({ success: false, error: 'File metadata missing' }, { status: 404 });
    }

    const mimeType = node.metadata.mimeType;
    const previewType = getMimePreviewType(mimeType);
    const storagePath = node.metadata.storagePath;
    const fullPath = resolveStoragePath(storagePath);

    // --- Text/code files (Tier 1 — UTF-8 text endpoint) ---
    if (previewType === 'text') {
      let fileBuffer: Buffer;
      try { fileBuffer = await readFile(fullPath); } catch {
        return NextResponse.json({ success: false, error: 'File not found on disk' }, { status: 404 });
      }
      const textContent = fileBuffer.toString('utf-8');
      return new NextResponse(textContent, {
        headers: {
          'Content-Type': `${mimeType}; charset=utf-8`,
          'Content-Disposition': `inline; filename="${node.name}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // --- PPTX (Tier 3 — server-side text extraction → JSON) ---
    if (previewType === 'pptx') {
      let fileBuffer: Buffer;
      try { fileBuffer = await readFile(fullPath); } catch {
        return NextResponse.json({ success: false, error: 'File not found on disk' }, { status: 404 });
      }

      // Extract slide text content from PPTX XML
      const rawText = fileBuffer.toString('utf-8');
      const textMatches = rawText.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
      const slideTexts: string[] = [];
      if (textMatches) {
        slideTexts.push(
          textMatches
            .map(m => m.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, ''))
            .filter(t => t.trim())
            .join(' | ')
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          id: node.id,
          name: node.name,
          mimeType,
          sizeBytes: bigintToNumber(node.metadata.sizeBytes),
          previewType: 'pptx',
          slideTexts,
          totalSlides: slideTexts.length || 0,
          downloadUrl: `/api/upload/download/${id}`,
        },
      });
    }

    // --- Binary types (image, video, audio, PDF, docx, xlsx) ---
    // These are now served by /api/files/[nodeId]/content (authenticated streaming)
    // Return a redirect or metadata for backward compatibility
    if (previewType === 'image' || previewType === 'video' || previewType === 'audio' || previewType === 'pdf' || previewType === 'docx' || previewType === 'xlsx') {
      // Client-side uses contentUrl (/api/files/[id}/content) for these types
      // This fallback returns metadata in case something still calls this route
      return NextResponse.json({
        success: true,
        data: {
          id: node.id,
          name: node.name,
          mimeType,
          sizeBytes: bigintToNumber(node.metadata.sizeBytes),
          previewType,
          contentUrl: `/api/files/${id}/content`,
          downloadUrl: `/api/upload/download/${id}`,
        },
      });
    }

    // --- Unsupported / download-only types ---
    if (previewType === 'none' || previewType === 'download') {
      return NextResponse.json({
        success: true,
        data: {
          id: node.id,
          name: node.name,
          mimeType,
          sizeBytes: bigintToNumber(node.metadata.sizeBytes),
          previewType: 'none',
          downloadUrl: `/api/upload/download/${id}`,
          message: 'No inline preview available',
        },
      });
    }

    // Fallback
    return NextResponse.json({
      success: true,
      data: {
        id: node.id,
        name: node.name,
        mimeType,
        sizeBytes: bigintToNumber(node.metadata.sizeBytes),
        previewType: 'none',
        downloadUrl: `/api/upload/download/${id}`,
        message: 'No preview available',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Preview failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
