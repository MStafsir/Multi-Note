// ============================================================
// MODUL 7: File Preview API Route
// Serves file previews based on MIME type:
// - Images: served directly with Content-Type
// - PDFs: served inline with application/pdf
// - Videos/Audio: served with proper Content-Type, Range header
// - Text/code: served as UTF-8 text for inline rendering
// - Office docs: docx→HTML (mammoth), xlsx→JSON (SheetJS), pptx→text
// - Other: returns JSON metadata + download link
// Auth: uses middleware-injected x-user-id header
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkNodeAccess } from '@/lib/permissions';
import { readFile, stat, open } from 'fs/promises';
import path from 'path';
import { getMimePreviewType } from '@/lib/mime-icons';
import { bigintToNumber } from '@/lib/bigint';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');

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
    const fullPath = storagePath.startsWith('/') ? storagePath : path.join(UPLOAD_DIR, path.basename(storagePath));

    // --- Text/code files ---
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

    // --- Office documents ---
    if (previewType === 'office') {
      let fileBuffer: Buffer;
      try { fileBuffer = await readFile(fullPath); } catch {
        return NextResponse.json({ success: false, error: 'File not found on disk' }, { status: 404 });
      }

      const isDocx = mimeType.includes('wordprocessingml') || mimeType.includes('msword');
      const isXlsx = mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel');
      const isPptx = mimeType.includes('presentationml') || mimeType.includes('ms-powerpoint');

      if (isDocx) {
        try {
          const mammoth = await import('mammoth');
          const result = await mammoth.convertToHtml({ buffer: fileBuffer });
          const htmlContent = result.value;
          const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;padding:16px;color:#333;max-width:800px;margin:0 auto}
h1{font-size:1.5em;margin-top:0}h2{font-size:1.3em}h3{font-size:1.1em}
p{margin:.5em 0}table{border-collapse:collapse;width:100%;margin:1em 0}
td,th{border:1px solid #ddd;padding:8px}img{max-width:100%;height:auto}
</style></head><body>${htmlContent}</body></html>`;
          return new NextResponse(fullHtml, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Disposition': `inline; filename="${node.name}"`,
              'Cache-Control': 'private, max-age=3600',
              'X-Preview-Format': 'docx-html',
            },
          });
        } catch (err) {
          console.error('mammoth conversion error:', err);
          return NextResponse.json({
            success: true, data: {
              id: node.id, name: node.name, mimeType, sizeBytes: bigintToNumber(node.metadata.sizeBytes),
              previewType: 'office', officeSubType: 'docx',
              conversionError: 'Failed to convert document for preview',
              downloadUrl: `/api/upload/download/${id}`,
            },
          });
        }
      }

      if (isXlsx) {
        try {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
          const sheets: Record<string, { rows: Record<string, string | number | boolean | null>[]; headers: string[] }> = {};
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number | boolean | null>>(sheet, { defval: null });
            let headers: string[] = [];
            if (jsonData.length > 0) { headers = Object.keys(jsonData[0]); }
            else {
              const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
              for (let c = range.s.c; c <= range.e.c; c++) {
                const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c });
                const cell = sheet[cellAddress];
                headers.push(cell ? String(cell.v) : `Column ${c + 1}`);
              }
            }
            sheets[sheetName] = { rows: jsonData, headers };
          }
          return NextResponse.json({
            success: true, data: {
              id: node.id, name: node.name, mimeType, sizeBytes: bigintToNumber(node.metadata.sizeBytes),
              previewType: 'office', officeSubType: 'xlsx',
              sheetNames: workbook.SheetNames, sheets,
            },
          });
        } catch (err) {
          console.error('xlsx conversion error:', err);
          return NextResponse.json({
            success: true, data: {
              id: node.id, name: node.name, mimeType, sizeBytes: bigintToNumber(node.metadata.sizeBytes),
              previewType: 'office', officeSubType: 'xlsx',
              conversionError: 'Failed to parse spreadsheet for preview',
              downloadUrl: `/api/upload/download/${id}`,
            },
          });
        }
      }

      if (isPptx) {
        const rawText = fileBuffer.toString('utf-8');
        const textMatches = rawText.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
        const slideTexts: string[] = [];
        if (textMatches) {
          slideTexts.push(textMatches.map(m => m.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, '')).filter(t => t.trim()).join(' | '));
        }
        return NextResponse.json({
          success: true, data: {
            id: node.id, name: node.name, mimeType, sizeBytes: bigintToNumber(node.metadata.sizeBytes),
            previewType: 'office', officeSubType: 'pptx',
            slideTexts, totalSlides: slideTexts.length || 0,
            downloadUrl: `/api/upload/download/${id}`,
          },
        });
      }

      return NextResponse.json({
        success: true, data: {
          id: node.id, name: node.name, mimeType, sizeBytes: bigintToNumber(node.metadata.sizeBytes),
          previewType: 'office', officeSubType: 'unknown', downloadUrl: `/api/upload/download/${id}`,
        },
      });
    }

    // --- Unsupported types ---
    if (previewType === 'none' || previewType === 'download') {
      return NextResponse.json({
        success: true, data: {
          id: node.id, name: node.name, mimeType, sizeBytes: bigintToNumber(node.metadata.sizeBytes),
          previewType: 'none', downloadUrl: `/api/upload/download/${id}`,
          message: 'No inline preview available',
        },
      });
    }

    // Check file exists for binary types
    let fileStat;
    try { fileStat = await stat(fullPath); } catch {
      return NextResponse.json({ success: false, error: 'File not found on disk' }, { status: 404 });
    }

    // --- Video/Audio: Range streaming ---
    if (previewType === 'video' || previewType === 'audio') {
      const rangeHeader = request.headers.get('range');
      if (rangeHeader) {
        const fileSize = fileStat.size;
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        if (start >= fileSize || end >= fileSize) {
          return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${fileSize}` } });
        }
        const chunkSize = end - start + 1;
        const fileHandle = await open(fullPath, 'r');
        const buffer = Buffer.alloc(chunkSize);
        await fileHandle.read(buffer, 0, chunkSize, start);
        await fileHandle.close();
        return new NextResponse(buffer, {
          status: 206,
          headers: { 'Content-Range': `bytes ${start}-${end}/${fileSize}`, 'Accept-Ranges': 'bytes', 'Content-Length': String(chunkSize), 'Content-Type': mimeType, 'Content-Disposition': `inline; filename="${node.name}"`, 'Cache-Control': 'private, max-age=3600' },
        });
      }
      const fileBuffer = await readFile(fullPath);
      return new NextResponse(fileBuffer, {
        headers: { 'Content-Type': mimeType, 'Content-Disposition': `inline; filename="${node.name}"`, 'Content-Length': String(fileBuffer.length), 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' },
      });
    }

    // --- Image ---
    if (previewType === 'image') {
      const fileBuffer = await readFile(fullPath);
      const headers: Record<string, string> = { 'Content-Type': mimeType, 'Content-Disposition': `inline; filename="${node.name}"`, 'Content-Length': String(fileBuffer.length), 'Cache-Control': 'private, max-age=3600' };
      const sizeParam = new URL(request.url).searchParams.get('size');
      if (sizeParam === 'thumbnail') headers['X-Preview-Size'] = 'thumbnail';
      return new NextResponse(fileBuffer, { headers });
    }

    // --- PDF ---
    if (previewType === 'pdf') {
      const fileBuffer = await readFile(fullPath);
      return new NextResponse(fileBuffer, {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${node.name}"`, 'Content-Length': String(fileBuffer.length), 'Cache-Control': 'private, max-age=3600' },
      });
    }

    // Fallback
    return NextResponse.json({
      success: true, data: {
        id: node.id, name: node.name, mimeType, sizeBytes: bigintToNumber(node.metadata.sizeBytes),
        previewType: 'none', downloadUrl: `/api/upload/download/${id}`, message: 'No preview available',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Preview failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
