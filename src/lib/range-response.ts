// ============================================================
// MODUL 50-51 Phase 1: Range Response Utility
// Reusable HTTP Range response builder for file streaming
// Supports 206 Partial Content, 200 Full Content, 416 Range Not Satisfiable
// ============================================================

import { NextResponse } from 'next/server';
import fs from 'fs';

export interface RangeResponseOptions {
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileName: string;
  checksumSha256?: string;
  rangeHeader?: string | null;
  isDownload?: boolean;
}

/**
 * Build a NextResponse for file content serving with HTTP Range support.
 *
 * - If a valid Range header is provided → 206 Partial Content with Content-Range
 * - If no Range header → 200 OK with full file body
 * - If invalid Range → 416 Range Not Satisfiable
 *
 * Always includes: Content-Type, Accept-Ranges: bytes
 * Optional: ETag (from checksumSha256), X-Content-Checksum
 * Content-Disposition: inline unless isDownload=true (then attachment)
 * Cache-Control: private, max-age=3600
 */
export async function buildRangeResponse(options: RangeResponseOptions): Promise<NextResponse> {
  const {
    filePath,
    fileSize,
    mimeType,
    fileName,
    checksumSha256,
    rangeHeader,
    isDownload = false,
  } = options;

  // Base headers always included
  const baseHeaders: Record<string, string> = {
    'Content-Type': mimeType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    'Content-Disposition': isDownload
      ? `attachment; filename="${fileName}"`
      : `inline; filename="${fileName}"`,
  };

  // Include ETag if checksum available
  if (checksumSha256) {
    baseHeaders['ETag'] = `"${checksumSha256}"`;
    baseHeaders['X-Content-Checksum'] = `sha256:${checksumSha256}`;
  }

  // No Range header → full file response (200)
  if (!rangeHeader) {
    const stream = fs.createReadStream(filePath);
    const webStream = nodeStreamToWebStream(stream);

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        ...baseHeaders,
        'Content-Length': String(fileSize),
      },
    });
  }

  // Parse Range header: bytes=start-end
  const parsed = parseRangeHeader(rangeHeader, fileSize);

  // Invalid range → 416 Range Not Satisfiable
  if (!parsed.valid) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${fileSize}`,
      },
    });
  }

  // Valid range → 206 Partial Content
  const { start, end } = parsed;
  const contentLength = end - start + 1;

  const stream = fs.createReadStream(filePath, { start, end });
  const webStream = nodeStreamToWebStream(stream);

  return new NextResponse(webStream, {
    status: 206,
    headers: {
      ...baseHeaders,
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': String(contentLength),
    },
  });
}

/**
 * Parse an HTTP Range header (bytes=start-end format).
 * Returns { valid, start, end } or { valid: false } for invalid ranges.
 */
function parseRangeHeader(
  rangeHeader: string,
  fileSize: number
): { valid: true; start: number; end: number } | { valid: false } {
  // Only support "bytes" unit
  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) {
    return { valid: false };
  }

  const startStr = match[1];
  const endStr = match[2];

  let start: number;
  let end: number;

  // bytes=start-end (both specified)
  if (startStr !== '' && endStr !== '') {
    start = parseInt(startStr, 10);
    end = parseInt(endStr, 10);
  }
  // bytes=start- (start specified, end is file end)
  else if (startStr !== '' && endStr === '') {
    start = parseInt(startStr, 10);
    end = fileSize - 1;
  }
  // bytes=-suffix (last N bytes)
  else if (startStr === '' && endStr !== '') {
    const suffix = parseInt(endStr, 10);
    if (suffix <= 0 || suffix > fileSize) {
      return { valid: false };
    }
    start = fileSize - suffix;
    end = fileSize - 1;
  }
  // bytes=- (invalid: no start or end)
  else {
    return { valid: false };
  }

  // Validate range bounds
  if (start < 0 || start >= fileSize || end < start || end >= fileSize) {
    return { valid: false };
  }

  return { valid: true, start, end };
}

/**
 * Convert a Node.js Readable stream to a Web ReadableStream
 * for use with NextResponse.
 */
function nodeStreamToWebStream(nodeStream: fs.ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      nodeStream.on('end', () => {
        controller.close();
      });
      nodeStream.on('error', (err: Error) => {
        controller.error(err);
      });
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}
