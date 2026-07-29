// ============================================================
// LibreOffice Headless Conversion Utility
// Converts DOCX/XLSX/PPTX (and legacy formats) to PDF via soffice --headless
// Caches converted PDFs in <projectRoot>/cache/lo-pdf/ to avoid re-conversion
// Cache key: sha256 checksum of the source file (from FileMetadata.checksumSha256)
// Conversions are serialized (one at a time) via a Promise queue to avoid
// LibreOffice conflicts (only one soffice instance can run at a time)
// ============================================================

import { execFile } from 'child_process';
import { access, constants, rename } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { ensureCacheDir, getCachedPdfPath, getCacheFilePath } from '@/lib/cache-manager';

// ============================================================
// Promise queue — serializes LibreOffice conversions
// Only one soffice instance can run at a time; concurrent launches
// cause "lock file" errors and corrupted output.
// ============================================================

const conversionQueue: Array<() => Promise<void>> = [];
let isProcessing = false;

/**
 * Enqueue a conversion task and return a promise that resolves when it completes.
 * Tasks are processed one at a time (FIFO order).
 */
function enqueue(task: () => Promise<string>): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const wrappedTask = async (): Promise<void> => {
      try {
        const result = await task();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    conversionQueue.push(wrappedTask);
    processQueue();
  });
}

/**
 * Process the next task in the queue if not already processing.
 */
function processQueue(): void {
  if (isProcessing || conversionQueue.length === 0) return;

  isProcessing = true;
  const task = conversionQueue.shift()!;

  task()
    .then(() => {
      // Task completed, process next
    })
    .catch(() => {
      // Task failed, still process next
    })
    .finally(() => {
      isProcessing = false;
      processQueue();
    });
}

// ============================================================
// Configuration
// ============================================================

/** Path to the LibreOffice soffice binary */
const SOFFICE_PATH = '/usr/bin/soffice';

/** Timeout for LibreOffice conversion in milliseconds */
const CONVERSION_TIMEOUT_MS = 60_000;

// ============================================================
// Supported MIME types for conversion
// ============================================================

export const CONVERTIBLE_MIME_TYPES = new Set([
  // Microsoft Office Open XML formats
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // XLSX
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
  // Legacy Microsoft Office formats
  'application/msword',             // DOC
  'application/vnd.ms-excel',       // XLS
  'application/vnd.ms-powerpoint',  // PPT
  // OpenDocument formats
  'application/vnd.oasis.opendocument.text',         // ODT
  'application/vnd.oasis.opendocument.spreadsheet',   // ODS
  'application/vnd.oasis.opendocument.presentation',  // ODP
]);

/** PDF MIME type — used to check if file is already a PDF */
export const PDF_MIME_TYPE = 'application/pdf';

/**
 * Check if a MIME type is convertible to PDF via LibreOffice.
 */
export function isConvertibleMimeType(mimeType: string): boolean {
  return CONVERTIBLE_MIME_TYPES.has(mimeType);
}

/**
 * Check if a MIME type is already a PDF (no conversion needed).
 */
export function isPdfMimeType(mimeType: string): boolean {
  return mimeType === PDF_MIME_TYPE;
}

// ============================================================
// Core conversion function
// ============================================================

/**
 * Convert a file to PDF using LibreOffice headless mode.
 * If a cached PDF already exists for the given checksum, returns the cached path immediately.
 * Otherwise, runs soffice --headless --convert-to pdf and caches the result.
 *
 * @param storagePath - Absolute path to the source file on disk
 * @param checksumSha256 - SHA-256 checksum of the source file (used as cache key)
 * @returns Absolute path to the cached PDF file
 * @throws Error if the source file doesn't exist, conversion fails, or times out
 */
export async function convertToPdf(
  storagePath: string,
  checksumSha256: string
): Promise<string> {
  // 1. Validate source file exists
  try {
    await access(storagePath, constants.R_OK);
  } catch {
    throw new Error(`Source file not found or not readable: ${storagePath}`);
  }

  // 2. Check cache hit
  const cachedPath = getCachedPdfPath(checksumSha256);
  if (cachedPath) {
    return cachedPath;
  }

  // 3. Serialize via queue — only one conversion at a time
  return enqueue(() => performConversion(storagePath, checksumSha256));
}

/**
 * Perform the actual LibreOffice conversion (called inside the queue).
 * Uses a temp directory for output, then moves the result to the cache.
 */
async function performConversion(
  storagePath: string,
  checksumSha256: string
): Promise<string> {
  // Double-check cache after dequeuing (another request may have converted it)
  const cachedPath = getCachedPdfPath(checksumSha256);
  if (cachedPath) {
    return cachedPath;
  }

  // Prepare temp output directory
  const tempDir = path.join(tmpdir(), `lo-convert-${randomUUID()}`);
  const { mkdir } = await import('fs/promises');
  await mkdir(tempDir, { recursive: true });

  try {
    // Run soffice --headless --convert-to pdf
    const result = await runSoffice(storagePath, tempDir);

    // soffice outputs the PDF with the same base name as the source file
    const sourceBaseName = path.basename(storagePath, path.extname(storagePath));
    const tempPdfPath = path.join(tempDir, `${sourceBaseName}.pdf`);

    // Verify the output PDF exists
    try {
      await access(tempPdfPath, constants.R_OK);
    } catch {
      throw new Error(
        `LibreOffice conversion succeeded but output PDF not found at: ${tempPdfPath}. ` +
        `stdout: ${result.stdout}, stderr: ${result.stderr}`
      );
    }

    // Move to cache directory
    const cacheDir = ensureCacheDir();
    const finalPdfPath = getCacheFilePath(checksumSha256);
    await rename(tempPdfPath, finalPdfPath);

    return finalPdfPath;
  } finally {
    // Clean up temp directory
    try {
      const { rm } = await import('fs/promises');
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Non-critical: temp dir cleanup failure
    }
  }
}

/**
 * Run the soffice --headless --convert-to pdf command.
 * Returns the stdout and stderr from the process.
 */
function runSoffice(
  inputPath: string,
  outputDir: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', outputDir,
      inputPath,
    ];

    const child = execFile(
      SOFFICE_PATH,
      args,
      {
        timeout: CONVERSION_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
        env: {
          ...process.env,
          HOME: process.env.HOME || '/tmp',
          // Suppress javaldx warning by setting a user profile dir
          // This avoids the common "javaldx failed" warning in headless mode
        },
      },
      (error, stdout, stderr) => {
        const stdoutStr = (stdout || '').toString();
        const stderrStr = (stderr || '').toString();

        if (error) {
          // Check if it's a timeout
          if (error.killed) {
            reject(new Error(
              `LibreOffice conversion timed out after ${CONVERSION_TIMEOUT_MS / 1000}s ` +
              `for file: ${inputPath}`
            ));
            return;
          }

          // The javaldx warning is non-critical and should be ignored
          // It appears in stderr but doesn't affect the conversion
          const isJavaldxWarning = stderrStr.includes('javaldx') &&
            !stderrStr.toLowerCase().includes('error');

          // If the only stderr output is the javaldx warning, treat as success
          if (isJavaldxWarning && !error.message.includes('Error')) {
            resolve({ stdout: stdoutStr, stderr: stderrStr });
            return;
          }

          reject(new Error(
            `LibreOffice conversion failed for ${inputPath}: ${error.message}. ` +
            `stderr: ${stderrStr}`
          ));
          return;
        }

        resolve({ stdout: stdoutStr, stderr: stderrStr });
      }
    );

    // Kill the process if it takes too long (safety net beyond execFile timeout)
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }, CONVERSION_TIMEOUT_MS + 2000);
  });
}

/**
 * Get the current queue length (for monitoring/debugging).
 */
export function getQueueLength(): number {
  return conversionQueue.length;
}

/**
 * Get whether a conversion is currently in progress.
 */
export function isConverting(): boolean {
  return isProcessing;
}
