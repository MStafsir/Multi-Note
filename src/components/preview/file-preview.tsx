'use client';

// ============================================================
// MODUL 50-51 Phase 3: File Preview Component — 3-tier rendering
// Tier 1 (native browser): image, video, audio, PDF, text
//   - Image/Video/Audio: <img>/<video>/<audio> src={contentUrl}
//   - PDF: pdfjs-dist canvas rendering (dynamic import)
//   - Text: fetch from previewUrl (UTF-8 text endpoint)
// Tier 2 (client-side render): docx, xlsx
//   - DOCX: docx-preview renderAsync() → fallback mammoth convertToHtml()
//   - XLSX: SheetJS client-side parse → SpreadsheetPreview
// Tier 3 (server-side): pptx
//   - PPTX: server-side JSON → PresentationPreview
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  File,
  ImageIcon,
  Film,
  FileText,
  Music,
  Archive,
  Code,
  Presentation,
  FileSpreadsheet,
  FileQuestion,
  Download,
  Loader2,
  X,
  ExternalLink,
  Copy,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Eye,
} from 'lucide-react';
import {
  getMimePreviewType,
  getMimeIcon,
  getMimeLabel,
  formatFileSize,
  getPreviewTier,
  type PreviewType,
  type PreviewTier,
  type IconName,
} from '@/lib/mime-icons';
import { usePreviewCache } from '@/hooks/use-preview-cache';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { OpenWithDropdown } from '@/components/preview/open-with-dropdown';
import { OfflineBadge } from '@/components/ui/offline-badge';

interface FilePreviewProps {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  checksumSha256?: string | null;
  onClose?: () => void;
}

// Icon component lookup map
const ICON_COMPONENTS: Record<IconName, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  File,
  Image: ImageIcon,
  Film,
  FileText,
  Music,
  Archive,
  Code,
  Presentation,
  Spreadsheet: FileSpreadsheet,
  FileQuestion,
};

// ============================================================
// Spreadsheet Preview Sub-component
// Renders xlsx data as a scrollable table with sheet tabs
// ============================================================
function SpreadsheetPreview({ data, name }: {
  data: {
    sheetNames: string[];
    sheets: Record<string, { rows: Record<string, string | number | boolean | null>[]; headers: string[] }>;
  };
  name: string;
}) {
  const [activeSheet, setActiveSheet] = useState(data.sheetNames[0] || '');
  const sheetData = data.sheets[activeSheet];
  const maxRows = 200;

  if (!sheetData) {
    return <p className="text-sm text-muted-foreground">No data found in spreadsheet</p>;
  }

  return (
    <div className="flex flex-col w-full">
      {/* Sheet tabs */}
      {data.sheetNames.length > 1 && (
        <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
          {data.sheetNames.map((sheetName) => (
            <Button
              key={sheetName}
              variant={sheetName === activeSheet ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs whitespace-nowrap"
              onClick={() => setActiveSheet(sheetName)}
            >
              {sheetName}
            </Button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto max-h-[60vh] border rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr>
              {sheetData.headers.map((header, i) => (
                <th key={i} className="px-3 py-2 text-left font-medium border-b whitespace-nowrap">
                  {header || `Column ${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheetData.rows.slice(0, maxRows).map((row, i) => (
              <tr key={i} className="hover:bg-accent/30 transition-colors">
                {sheetData.headers.map((header, j) => (
                  <td key={j} className="px-3 py-1.5 border-b whitespace-nowrap max-w-[200px] truncate">
                    {row[header] !== null && row[header] !== undefined ? String(row[header]) : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sheetData.rows.length > maxRows && (
          <div className="p-2 text-center text-xs text-muted-foreground bg-muted/30">
            Showing {maxRows} of {sheetData.rows.length} rows
          </div>
        )}
        {sheetData.rows.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            This sheet is empty
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Presentation Preview Sub-component
// Shows extracted text content from PowerPoint slides
// ============================================================
function PresentationPreview({ data, name }: {
  data: {
    slideTexts: string[];
    totalSlides: number;
  };
  name: string;
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const hasSlides = data.slideTexts.length > 0;

  return (
    <div className="flex flex-col w-full items-center">
      {/* Slide display area */}
      <div className="w-full aspect-[16/9] bg-white rounded-lg border shadow-sm flex items-center justify-center p-8 mb-4">
        {hasSlides && data.slideTexts[currentSlide] ? (
          <div className="text-center w-full">
            <p className="text-lg font-medium leading-relaxed whitespace-pre-wrap">
              {data.slideTexts[currentSlide]}
            </p>
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            <Presentation className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No text content extracted from this slide</p>
          </div>
        )}
      </div>

      {/* Slide navigation */}
      {hasSlides && data.slideTexts.length > 1 && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Slide {currentSlide + 1} of {data.slideTexts.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentSlide(Math.min(data.slideTexts.length - 1, currentSlide + 1))}
            disabled={currentSlide === data.slideTexts.length - 1}
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PDF Preview (Tier 1 — pdfjs-dist canvas rendering)
// ============================================================
function PdfPreview({ contentUrl, name, sizeBytes, mimeLabel, closeButton }: {
  contentUrl: string;
  name: string;
  sizeBytes?: number;
  mimeLabel: string;
  closeButton: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const renderPage = useCallback(async (pageNum: number, pdfDoc: unknown, scale: number) => {
    const pdfDocument = pdfDoc as { getPage: (n: number) => Promise<{ render: (params: unknown) => Promise<void>; viewport: { width: number; height: number; scale: number } }> };
    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    let canvas = canvasRefs.current.get(pageNum);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRefs.current.set(pageNum, canvas);
      if (containerRef.current) {
        containerRef.current.appendChild(canvas);
      }
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    canvas.style.marginBottom = '8px';
    canvas.style.display = 'block';

    const context = canvas.getContext('2d');
    if (!context) return;

    await page.render({
      canvasContext: context,
      viewport,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        // Dynamic import of pdfjs-dist
        const pdfjsLib = await import('pdfjs-dist');
        // Use local worker from public dir (avoids CSP CDN blocking issues)
        pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

        // Fetch PDF as ArrayBuffer from contentUrl
        const res = await fetch(contentUrl, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to fetch PDF');
        const arrayBuffer = await res.arrayBuffer();

        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (!cancelled) {
          setNumPages(pdfDoc.numPages);
          setLoading(false);
        }

        // Render all pages
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          if (cancelled) break;
          await renderPage(i, pdfDoc, scale);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('PDF preview error:', err);
          setError(true);
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [contentUrl, renderPage]);

  // Re-render pages when scale changes
  useEffect(() => {
    if (numPages === 0 || loading) return;
    let cancelled = false;

    const rerender = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        // Use local worker from public dir (avoids CSP CDN blocking issues)
        pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

        const res = await fetch(contentUrl, { credentials: 'same-origin' });
        if (!res.ok) return;
        const arrayBuffer = await res.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        // Clear existing canvases
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        canvasRefs.current.clear();

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          if (cancelled) break;
          await renderPage(i, pdfDoc, scale);
        }
      } catch {
        // Silently fail on re-render
      }
    };

    rerender();
    return () => { cancelled = true; };
  }, [scale, numPages, contentUrl, renderPage]);

  if (error) {
    return (
      <div className="relative flex flex-col w-full">
        {closeButton}
        <Card className="w-full">
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Failed to load PDF preview</p>
            <Button variant="outline" size="sm" asChild>
              <a href={contentUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open PDF directly
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full">
      {closeButton}
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-5 w-5 text-red-500" />
        <span className="font-medium truncate max-w-xs">{name}</span>
        {sizeBytes && (
          <span className="text-sm text-muted-foreground">{formatFileSize(sizeBytes)}</span>
        )}
        <span className="text-xs text-muted-foreground">{mimeLabel}</span>
        <OfflineBadge />
        <div className="flex items-center gap-1 ml-auto">
          {numPages > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {currentPage}/{numPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                disabled={currentPage === numPages}
                aria-label="Next page"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setScale(Math.max(0.5, scale - 0.2))}
            disabled={scale <= 0.5}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setScale(Math.min(3, scale + 0.2))}
            disabled={scale >= 3}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading PDF…</span>
        </div>
      ) : (
        <ScrollArea className="w-full rounded-lg border bg-gray-50 dark:bg-gray-900" style={{ maxHeight: '70vh' }}>
          <div
            ref={containerRef}
            className="flex flex-col items-center p-4"
          />
        </ScrollArea>
      )}
    </div>
  );
}

// ============================================================
// DOCX Preview (Tier 2 — docx-preview with mammoth fallback)
// MODUL 51: Added offline message support + cache integration
// ============================================================
function DocxPreview({ id, contentUrl, name, sizeBytes, mimeLabel, downloadUrl, closeButton, cachedContent, isFromCache, offlineMessage, triggerBackgroundCache, isLoadingCache }: {
  id: string;
  contentUrl: string;
  name: string;
  sizeBytes?: number;
  mimeLabel: string;
  downloadUrl: string;
  closeButton: React.ReactNode;
  cachedContent: string | null;
  isFromCache: boolean;
  offlineMessage: string | null;
  triggerBackgroundCache: (content: string) => Promise<void>;
  isLoadingCache: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mammothHtml, setMammothHtml] = useState<string | null>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  // MODUL 51: If we have cached content and are offline or have a cache match, render it directly
  const shouldUseCache = isFromCache && cachedContent;

  useEffect(() => {
    // MODUL 51: If we have cached HTML content, use it directly
    if (shouldUseCache && cachedContent) {
      setMammothHtml(cachedContent);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadDocx = async () => {
      try {
        // Fetch raw bytes from contentUrl
        const res = await fetch(contentUrl, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to fetch document');
        const arrayBuffer = await res.arrayBuffer();

        // Try docx-preview first
        try {
          const docxPreview = await import('docx-preview');
          if (docxContainerRef.current && !cancelled) {
            await docxPreview.renderAsync(
              arrayBuffer,
              docxContainerRef.current,
              undefined,
              {
                className: 'docx-preview-wrapper',
                inWrapper: true,
                hideWrapperOnPrint: false,
                ignoreWidth: false,
                ignoreHeight: false,
                ignoreFonts: false,
                breakPages: true,
                ignoreLastRenderedPageBreak: true,
                experimental: true, // enables tab stops calculation (Modul 62.1)
                trimXmlDeclaration: true,
                useBase64URL: true, // ensures images are embedded (Modul 62.1)
                renderHeaders: true, // Modul 62.2
                renderFooters: true, // Modul 62.2
                renderFootnotes: true,
                renderEndnotes: true,
                renderAltChunks: true,
                renderChanges: false,
                renderComments: false,
                debug: false,
              }
            );
            if (!cancelled) {
              setLoading(false);
              // MODUL 51: Cache the rendered HTML — extract innerHTML from container for future offline use
              const renderedHtml = docxContainerRef.current.innerHTML;
              if (renderedHtml) {
                triggerBackgroundCache(renderedHtml).catch((err) => {
                  console.warn('[DocxPreview] Background cache write failed:', err);
                });
              }
            }
            return;
          }
        } catch (docxPreviewErr) {
          console.warn('docx-preview failed, falling back to mammoth:', docxPreviewErr);
        }

        // Fallback to mammoth
        if (!cancelled) {
          const mammoth = await import('mammoth');
          // In browser, mammoth expects {arrayBuffer: ArrayBuffer} not {buffer: Buffer}
          const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
          if (!cancelled) {
            setMammothHtml(result.value);
            setLoading(false);
            // MODUL 51: Cache the mammoth HTML result
            if (result.value) {
              triggerBackgroundCache(result.value).catch((err) => {
                console.warn('[DocxPreview] Background cache write failed:', err);
              });
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('DOCX preview error:', err);
          setError('Failed to load document preview');
          setLoading(false);
        }
      }
    };

    loadDocx();
    return () => { cancelled = true; };
  }, [contentUrl, shouldUseCache, cachedContent, triggerBackgroundCache]);

  if (error) {
    return (
      <div className="relative flex flex-col w-full">
        {closeButton}
        <Card className="w-full">
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" asChild>
              <a href={downloadUrl} download={name}>
                <Download className="h-4 w-4 mr-2" />
                Download to open
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // MODUL 51: Offline with no cache — show explicit offline message
  if (offlineMessage) {
    return (
      <div className="relative flex flex-col w-full">
        {closeButton}
        <Card className="w-full">
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <WifiOff className="h-12 w-12 text-orange-500" />
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">{offlineMessage}</p>
            <p className="text-xs text-muted-foreground text-center">
              Open this file while online to make it available offline later
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full">
      {closeButton}
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-5 w-5 text-blue-500" />
        <span className="font-medium truncate max-w-xs">{name}</span>
        {sizeBytes && (
          <span className="text-sm text-muted-foreground">{formatFileSize(sizeBytes)}</span>
        )}
        <span className="text-xs text-muted-foreground">{mimeLabel}</span>
        {isFromCache && <span className="text-xs text-emerald-600 dark:text-emerald-400">(cached)</span>}
        <OfflineBadge />
        <OpenWithDropdown nodeId={name} mimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document" fileName={name} />
        {/* MODUL 63.3: Link to high-fidelity dedicated viewer */}
        <Button variant="outline" size="sm" asChild>
          <a href={`/view/${id}`} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4 mr-2" />Tampilan Asli (PDF)
          </a>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading document…</span>
        </div>
      ) : mammothHtml ? (
        // Mammoth fallback: render HTML in styled div with forced black text
        <div
          className="w-full rounded-lg border bg-white p-6 overflow-auto max-h-[70vh]"
          style={{ color: '#1a1a1a' }}
          dangerouslySetInnerHTML={{ __html: mammothHtml }}
        />
      ) : (
        // docx-preview rendered into container ref with forced black text
        <div
          ref={docxContainerRef}
          className="docx-preview-wrapper w-full rounded-lg border bg-white overflow-auto max-h-[70vh]"
          style={{ color: '#1a1a1a' }}
        />
      )}
    </div>
  );
}

// ============================================================
// XLSX Preview (Tier 2 — client-side SheetJS parse)
// MODUL 51: Added offline message support + cache integration
// ============================================================
function XlsxPreview({ id, contentUrl, name, sizeBytes, mimeLabel, downloadUrl, closeButton, cachedContent, isFromCache, offlineMessage, triggerBackgroundCache, isLoadingCache }: {
  id: string;
  contentUrl: string;
  name: string;
  sizeBytes?: number;
  mimeLabel: string;
  downloadUrl: string;
  closeButton: React.ReactNode;
  cachedContent: string | null;
  isFromCache: boolean;
  offlineMessage: string | null;
  triggerBackgroundCache: (content: string) => Promise<void>;
  isLoadingCache: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spreadsheetData, setSpreadsheetData] = useState<{
    sheetNames: string[];
    sheets: Record<string, { rows: Record<string, string | number | boolean | null>[]; headers: string[] }>;
  } | null>(null);

  // MODUL 51: If we have cached content and are offline or have a cache match, parse it directly
  const shouldUseCache = isFromCache && cachedContent;

  useEffect(() => {
    // MODUL 51: If we have cached JSON content, parse it directly
    if (shouldUseCache && cachedContent) {
      try {
        const parsed = JSON.parse(cachedContent);
        setSpreadsheetData(parsed);
        setLoading(false);
      } catch (err) {
        console.warn('[XlsxPreview] Failed to parse cached content:', err);
        // Fall through to network fetch
      }
      return;
    }

    let cancelled = false;

    const loadXlsx = async () => {
      try {
        // Fetch raw bytes from contentUrl
        const res = await fetch(contentUrl, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to fetch spreadsheet');
        const arrayBuffer = await res.arrayBuffer();

        // Dynamic import of SheetJS
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const sheetNames = workbook.SheetNames;
        const sheets: Record<string, { rows: Record<string, string | number | boolean | null>[]; headers: string[] }> = {};

        for (const sheetName of sheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;

          const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number | boolean | null>>(worksheet, { defval: null, raw: false });
          const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

          sheets[sheetName] = {
            rows: jsonData.slice(0, 200),
            headers,
          };
        }

        if (!cancelled) {
          setSpreadsheetData({ sheetNames, sheets });
          setLoading(false);
          // MODUL 51: Cache the parsed spreadsheet data as JSON
          triggerBackgroundCache(JSON.stringify({ sheetNames, sheets })).catch((err) => {
            console.warn('[XlsxPreview] Background cache write failed:', err);
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error('XLSX preview error:', err);
          setError('Failed to load spreadsheet preview');
          setLoading(false);
        }
      }
    };

    loadXlsx();
    return () => { cancelled = true; };
  }, [contentUrl, shouldUseCache, cachedContent, triggerBackgroundCache]);

  if (error) {
    return (
      <div className="relative flex flex-col w-full">
        {closeButton}
        <Card className="w-full">
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" asChild>
              <a href={downloadUrl} download={name}>
                <Download className="h-4 w-4 mr-2" />
                Download to open
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // MODUL 51: Offline with no cache — show explicit offline message
  if (offlineMessage) {
    return (
      <div className="relative flex flex-col w-full">
        {closeButton}
        <Card className="w-full">
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <WifiOff className="h-12 w-12 text-orange-500" />
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">{offlineMessage}</p>
            <p className="text-xs text-muted-foreground text-center">
              Open this file while online to make it available offline later
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full">
      {closeButton}
      <div className="flex items-center gap-2 mb-3">
        <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
        <span className="font-medium truncate max-w-xs">{name}</span>
        {sizeBytes && (
          <span className="text-sm text-muted-foreground">{formatFileSize(sizeBytes)}</span>
        )}
        <span className="text-xs text-muted-foreground">{mimeLabel}</span>
        {isFromCache && <span className="text-xs text-emerald-600 dark:text-emerald-400">(cached)</span>}
        <OfflineBadge />
        <OpenWithDropdown nodeId={name} mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" fileName={name} />
        {/* MODUL 63.3: Link to high-fidelity dedicated viewer */}
        <Button variant="outline" size="sm" asChild>
          <a href={`/view/${id}`} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4 mr-2" />Tampilan Asli (PDF)
          </a>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading spreadsheet…</span>
        </div>
      ) : spreadsheetData ? (
        <SpreadsheetPreview data={spreadsheetData} name={name} />
      ) : null}
    </div>
  );
}

// ============================================================
// PPTX Preview (Tier 3 — server-side JSON)
// MODUL 51: Added offline message support + cache integration
// ============================================================
function PptxPreview({ id, previewUrl, name, sizeBytes, mimeLabel, downloadUrl, closeButton, cachedContent, isFromCache, offlineMessage, triggerBackgroundCache, isLoadingCache }: {
  id: string;
  previewUrl: string;
  name: string;
  sizeBytes?: number;
  mimeLabel: string;
  downloadUrl: string;
  closeButton: React.ReactNode;
  cachedContent: string | null;
  isFromCache: boolean;
  offlineMessage: string | null;
  triggerBackgroundCache: (content: string) => Promise<void>;
  isLoadingCache: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [presentationData, setPresentationData] = useState<{
    slideTexts: string[];
    totalSlides: number;
  } | null>(null);

  // MODUL 51: If we have cached content, parse it directly
  const shouldUseCache = isFromCache && cachedContent;

  useEffect(() => {
    // MODUL 51: If we have cached JSON content, parse it directly
    if (shouldUseCache && cachedContent) {
      try {
        const parsed = JSON.parse(cachedContent);
        setPresentationData(parsed);
        setLoading(false);
      } catch (err) {
        console.warn('[PptxPreview] Failed to parse cached content:', err);
        // Fall through to network fetch
      }
      return;
    }

    let cancelled = false;

    const loadPptx = async () => {
      try {
        const res = await fetch(previewUrl, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to load presentation preview');
        const data = await res.json();

        if (!cancelled) {
          if (data.success && data.data) {
            const pptxData = {
              slideTexts: data.data.slideTexts || [],
              totalSlides: data.data.totalSlides || 0,
            };
            setPresentationData(pptxData);
            // MODUL 51: Cache the presentation data as JSON
            triggerBackgroundCache(JSON.stringify(pptxData)).catch((err) => {
              console.warn('[PptxPreview] Background cache write failed:', err);
            });
          } else {
            setError('No preview data available');
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('PPTX preview error:', err);
          setError('Failed to load presentation preview');
          setLoading(false);
        }
      }
    };

    loadPptx();
    return () => { cancelled = true; };
  }, [previewUrl, shouldUseCache, cachedContent, triggerBackgroundCache]);

  if (error) {
    return (
      <div className="relative flex flex-col w-full">
        {closeButton}
        <Card className="w-full">
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <Presentation className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" asChild>
              <a href={downloadUrl} download={name}>
                <Download className="h-4 w-4 mr-2" />
                Download to open
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // MODUL 51: Offline with no cache — show explicit offline message
  if (offlineMessage) {
    return (
      <div className="relative flex flex-col w-full">
        {closeButton}
        <Card className="w-full">
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <WifiOff className="h-12 w-12 text-orange-500" />
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">{offlineMessage}</p>
            <p className="text-xs text-muted-foreground text-center">
              Open this file while online to make it available offline later
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full">
      {closeButton}
      <div className="flex items-center gap-2 mb-3">
        <Presentation className="h-5 w-5 text-orange-500" />
        <span className="font-medium truncate max-w-xs">{name}</span>
        {sizeBytes && (
          <span className="text-sm text-muted-foreground">{formatFileSize(sizeBytes)}</span>
        )}
        <span className="text-xs text-muted-foreground">{mimeLabel}</span>
        {isFromCache && <span className="text-xs text-emerald-600 dark:text-emerald-400">(cached)</span>}
        <OfflineBadge />
        <OpenWithDropdown nodeId={name} mimeType="application/vnd.openxmlformats-officedocument.presentationml.presentation" fileName={name} />
        {/* MODUL 63.3: Link to high-fidelity dedicated viewer */}
        <Button variant="outline" size="sm" asChild>
          <a href={`/view/${id}`} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4 mr-2" />Tampilan Asli (PDF)
          </a>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading presentation…</span>
        </div>
      ) : presentationData ? (
        <PresentationPreview data={presentationData} name={name} />
      ) : null}
    </div>
  );
}

// ============================================================
// Main FilePreview Component
// ============================================================
export function FilePreview({ id, name, mimeType, sizeBytes, checksumSha256, onClose }: FilePreviewProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [textContent, setTextContent] = useState<string>('');
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState(false);

  const previewType = getMimePreviewType(mimeType);
  const iconName = getMimeIcon(mimeType);
  const mimeLabel = getMimeLabel(mimeType);
  const IconComponent = ICON_COMPONENTS[iconName] || FileQuestion;
  const previewTier: PreviewTier = getPreviewTier(mimeType);

  const previewUrl = `/api/preview/${id}`;
  const downloadUrl = `/api/files/${id}/content?download=true`;
  const contentUrl = `/api/files/${id}/content`;

  // MODUL 51: Preview cache hook for Tier 2/3 offline support
  const {
    cachedContent,
    isFromCache,
    isLoadingCache,
    offlineMessage,
    triggerBackgroundCache,
  } = usePreviewCache({
    nodeId: id,
    mimeType,
    checksumSha256: checksumSha256 || null,
    previewTier,
  });

  // Fetch text content for text/code preview (Tier 1 — still uses previewUrl for UTF-8 text)
  useEffect(() => {
    if (previewType === 'text') {
      let cancelled = false;
      const loadText = async () => {
        try {
          const res = await fetch(previewUrl, { credentials: 'same-origin' });
          if (!res.ok) throw new Error('Failed to load text content');
          const content = await res.text();
          if (!cancelled) {
            setTextContent(content);
          }
        } catch {
          if (!cancelled) {
            setTextError(true);
          }
        }
      };
      setTextLoading(true);
      setTextError(false);
      loadText().finally(() => {
        if (!cancelled) setTextLoading(false);
      });
      return () => { cancelled = true; };
    }
  }, [previewType, previewUrl]);

  // Render close button
  const closeButton = onClose ? (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-background/80 hover:bg-background"
      onClick={onClose}
      aria-label="Close preview"
    >
      <X className="h-4 w-4" />
    </Button>
  ) : null;

  // --- Image Preview (Tier 1) ---
  if (previewType === 'image') {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[200px] max-h-[70vh]">
        {closeButton}
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {imageError ? (
          <Card className="w-full max-w-md">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <ImageIcon className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Failed to load image</p>
              <Button variant="outline" size="sm" asChild>
                <a href={downloadUrl} download={name}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <img
            src={contentUrl}
            alt={name}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
            style={{ backgroundColor: 'white' }}
            loading="lazy"
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
              setImageError(true);
            }}
          />
        )}
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          <span className="font-medium truncate max-w-xs">{name}</span>
          {sizeBytes && <span>{formatFileSize(sizeBytes)}</span>}
          <span className="text-xs">{mimeLabel}</span>
          <OfflineBadge />
        </div>
      </div>
    );
  }

  // --- PDF Preview (Tier 1 — pdfjs-dist canvas) ---
  if (previewType === 'pdf') {
    return (
      <PdfPreview
        contentUrl={contentUrl}
        name={name}
        sizeBytes={sizeBytes}
        mimeLabel={mimeLabel}
        closeButton={closeButton}
      />
    );
  }

  // --- Video Preview (Tier 1) ---
  if (previewType === 'video') {
    return (
      <div className="relative flex flex-col items-center w-full">
        {closeButton}
        <video
          src={contentUrl}
          controls
          preload="metadata"
          className="max-w-full max-h-[70vh] rounded-lg"
          aria-label={`Video preview of ${name}`}
        >
          Your browser does not support video playback.
        </video>
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          <Film className="h-4 w-4" />
          <span className="font-medium truncate max-w-xs">{name}</span>
          {sizeBytes && <span>{formatFileSize(sizeBytes)}</span>}
          <span className="text-xs">{mimeLabel}</span>
          <OfflineBadge />
        </div>
      </div>
    );
  }

  // --- Audio Preview (Tier 1) ---
  if (previewType === 'audio') {
    return (
      <div className="relative flex flex-col items-center w-full p-6">
        {closeButton}
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Music className="h-8 w-8 text-muted-foreground" />
        </div>
        <span className="font-medium truncate max-w-xs mb-2">{name}</span>
        <audio
          src={contentUrl}
          controls
          preload="metadata"
          className="w-full max-w-md"
          aria-label={`Audio preview of ${name}`}
        >
          Your browser does not support audio playback.
        </audio>
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          {sizeBytes && <span>{formatFileSize(sizeBytes)}</span>}
          <span className="text-xs">{mimeLabel}</span>
          <OfflineBadge />
        </div>
      </div>
    );
  }

  // --- Text/Code Preview (Tier 1) ---
  if (previewType === 'text') {
    return (
      <div className="relative flex flex-col w-full">
        {closeButton}
        <div className="flex items-center gap-2 mb-3">
          <Code className="h-5 w-5 text-emerald-500" />
          <span className="font-medium truncate max-w-xs">{name}</span>
          {sizeBytes && (
            <span className="text-sm text-muted-foreground">{formatFileSize(sizeBytes)}</span>
          )}
          <span className="text-xs text-muted-foreground">{mimeLabel}</span>
          <OfflineBadge />
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(textContent);
                toast.success('Copied to clipboard');
              }}
              disabled={textLoading || textError}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
          </div>
        </div>
        {textLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : textError ? (
          <Card className="w-full">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <Code className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Failed to load text content</p>
            </CardContent>
          </Card>
        ) : (
          <div className="relative rounded-lg border bg-white overflow-hidden" style={{ color: '#1a1a1a' }}>
            <pre className="p-4 text-sm font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap break-words leading-relaxed">
              {textContent}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // --- DOCX Preview (Tier 2 — client-side) ---
  if (previewType === 'docx') {
    return (
      <DocxPreview
        id={id}
        contentUrl={contentUrl}
        name={name}
        sizeBytes={sizeBytes}
        mimeLabel={mimeLabel}
        downloadUrl={downloadUrl}
        closeButton={closeButton}
        cachedContent={cachedContent}
        isFromCache={isFromCache}
        offlineMessage={offlineMessage}
        triggerBackgroundCache={triggerBackgroundCache}
        isLoadingCache={isLoadingCache}
      />
    );
  }

  // --- XLSX Preview (Tier 2 — client-side) ---
  if (previewType === 'xlsx') {
    return (
      <XlsxPreview
        id={id}
        contentUrl={contentUrl}
        name={name}
        sizeBytes={sizeBytes}
        mimeLabel={mimeLabel}
        downloadUrl={downloadUrl}
        closeButton={closeButton}
        cachedContent={cachedContent}
        isFromCache={isFromCache}
        offlineMessage={offlineMessage}
        triggerBackgroundCache={triggerBackgroundCache}
        isLoadingCache={isLoadingCache}
      />
    );
  }

  // --- PPTX Preview (Tier 3 — server-side) ---
  if (previewType === 'pptx') {
    return (
      <PptxPreview
        id={id}
        previewUrl={previewUrl}
        name={name}
        sizeBytes={sizeBytes}
        mimeLabel={mimeLabel}
        downloadUrl={downloadUrl}
        closeButton={closeButton}
        cachedContent={cachedContent}
        isFromCache={isFromCache}
        offlineMessage={offlineMessage}
        triggerBackgroundCache={triggerBackgroundCache}
        isLoadingCache={isLoadingCache}
      />
    );
  }

  // --- Download-only Preview (archives, etc.) ---
  if (previewType === 'download' || previewType === 'none') {
    return (
      <div className="relative flex flex-col items-center w-full p-6">
        {closeButton}
        <Card className="w-full max-w-md">
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
              <IconComponent className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium truncate max-w-full">{name}</p>
              <p className="text-sm text-muted-foreground mt-1">{mimeLabel}</p>
              {sizeBytes && (
                <p className="text-sm text-muted-foreground">{formatFileSize(sizeBytes)}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              No preview available for this file type
            </p>
            <OfflineBadge />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={downloadUrl} download={name}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Fallback ---
  return (
    <div className="relative flex flex-col items-center w-full p-6">
      {closeButton}
      <Card className="w-full max-w-md">
        <CardContent className="p-6 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
            <IconComponent className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium truncate max-w-full">{name}</p>
            <p className="text-sm text-muted-foreground mt-1">{mimeLabel}</p>
            {sizeBytes && (
              <p className="text-sm text-muted-foreground">{formatFileSize(sizeBytes)}</p>
            )}
          </div>
          <OfflineBadge />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={downloadUrl} download={name}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
