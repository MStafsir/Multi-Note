'use client';

// ============================================================
// MODUL 61-65: Dedicated New-Tab Viewer — ALL file types supported
// Opens in a new browser tab like Google Drive.
// No download prompt — file opens directly.
// A4-paper-style rendering for documents.
//
// TWO rendering paths for office documents:
//   Default (MODUL 64): LibreOffice → PDF → pdf.js (high-fidelity)
//   Secondary (fast): docx-preview / SheetJS / text-extraction
//
// MODUL 64: Default view-mode is now high-fidelity (LibreOffice→PDF)
//   for all office types (DOCX, XLSX, PPTX). The "Tampilan Cepat"
//   toggle switches to the fast path for large files.
//
// MODUL 65: Header reuses dark-theme tokens from app-shell,
//   proper spacing, z-index, and WCAG contrast.
//
// All file bytes fetched via /api/files/[nodeId]/content
// (session-authenticated, same-origin, zero external calls).
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Download,
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  Eye,
  Zap,
} from 'lucide-react';
import { formatFileSize, isOfficePreviewType } from '@/lib/mime-icons';
import type { PreviewType, PreviewTier } from '@/lib/mime-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface DedicatedViewerProps {
  nodeId: string;
  name: string;
  mimeType: string;
  previewType: PreviewType;
  previewTier: PreviewTier;
  mimeLabel: string;
  sizeBytes: number;
  checksumSha256: string | null;
}

// Whether this preview type supports high-fidelity (LibreOffice) rendering
const HI_FI_TYPES: PreviewType[] = ['docx', 'xlsx', 'pptx'];

// ============================================================
// Spreadsheet Preview Sub-component
// MODUL 58: Multi-sheet tab switcher, computed values, error state
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
    return (
      <div className="flex flex-col items-center gap-3 p-8">
        <AlertTriangle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No data found in spreadsheet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* Sheet tabs — only show if more than 1 sheet */}
      {data.sheetNames.length > 1 && (
        <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1 border-b">
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

      {/* Spreadsheet table */}
      <div className="overflow-auto max-h-[70vh] border rounded-lg">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
            <tr>
              <th className="px-3 py-2 text-left font-medium border-b bg-muted/60 text-xs text-muted-foreground w-12">#</th>
              {sheetData.headers.map((header, i) => (
                <th key={i} className="px-3 py-2 text-left font-medium border-b whitespace-nowrap text-xs">
                  {header || `Column ${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheetData.rows.slice(0, maxRows).map((row, i) => (
              <tr key={i} className="hover:bg-accent/30 transition-colors">
                <td className="px-3 py-1.5 border-b text-xs text-muted-foreground">{i + 1}</td>
                {sheetData.headers.map((header, j) => (
                  <td key={j} className="px-3 py-1.5 border-b whitespace-nowrap max-w-[300px] truncate text-sm">
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
      </div>
    </div>
  );
}

// ============================================================
// Presentation Preview Sub-component
// ============================================================
function PresentationPreview({ data }: {
  data: { slideTexts: string[]; totalSlides: number; };
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const hasSlides = data.slideTexts.length > 0;

  return (
    <div className="flex flex-col w-full items-center">
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

      {hasSlides && data.slideTexts.length > 1 && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Slide {currentSlide + 1} of {data.slideTexts.length}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setCurrentSlide(Math.min(data.slideTexts.length - 1, currentSlide + 1))}
            disabled={currentSlide === data.slideTexts.length - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PDF Preview Sub-component (uses pdfjs-dist)
// Shared by both Tier 1 (native PDF) and High-Fidelity (LibreOffice→PDF)
// ============================================================
function PdfPreview({ contentUrl, onError }: { contentUrl: string; onError?: () => void }) {
  const [numPages, setNumPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<unknown>(null);
  const [scale, setScale] = useState(1.2);
  const [pdfError, setPdfError] = useState<string | null>(null);
  // MODUL 64.5: Explicit loading state for cache-miss scenario
  const [pdfLoading, setPdfLoading] = useState(true);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setPdfLoading(true);
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const res = await fetch(contentUrl, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
        const arrayBuffer = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        if (!cancelled) {
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setPdfLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('PDF load error:', err);
          setPdfError('Failed to load PDF document');
          setPdfLoading(false);
          onError?.();
        }
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [contentUrl]);

  // Render all pages when pdfDoc or scale changes
  useEffect(() => {
    if (!pdfDoc || numPages === 0) return;
    let cancelled = false;

    const renderAllPages = async () => {
      const pdfjsLib = await import('pdfjs-dist');

      for (let i = 1; i <= numPages; i++) {
        if (cancelled) break;
        try {
          const page = await (pdfDoc as { getPage: (n: number) => Promise<unknown> }).getPage(i);
          const viewport = (page as { getViewport: (opts: { scale: number }) => { width: number; height: number } }).getViewport({ scale });
          const canvas = canvasRefs.current.get(i);
          if (!canvas) continue;

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const context = canvas.getContext('2d');
          if (!context) continue;

          const renderContext = { canvasContext: context, viewport };
          await (page as { render: (ctx: unknown) => Promise<unknown> }).render(renderContext).promise;
        } catch (err) {
          console.error(`PDF render error page ${i}:`, err);
        }
      }
    };

    renderAllPages();
    return () => { cancelled = true; };
  }, [pdfDoc, numPages, scale]);

  if (pdfError) {
    return (
      <div className="flex flex-col items-center gap-3 p-8">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{pdfError}</p>
      </div>
    );
  }

  // MODUL 64.5: Explicit loading state for cache-miss (first-time conversion)
  if (pdfLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Mengkonversi dokumen ke PDF…</p>
          <p className="text-xs text-muted-foreground mt-1">Proses ini memerlukan LibreOffice dan hanya terjadi sekali (cache-miss)</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* MODUL 65: PDF Zoom Controls — dark-theme tokens */}
      <div className="flex items-center gap-2 mb-3 sticky top-0 z-10 bg-background/95 backdrop-blur py-2 px-4 rounded-lg shadow-sm border border-border">
        <span className="text-sm text-muted-foreground">
          {numPages} page{numPages !== 1 ? 's' : ''}
        </span>
        <span className="mx-2 text-border">|</span>
        <Button variant="outline" size="icon" className="h-8 w-8"
          onClick={() => setScale(Math.max(0.5, scale - 0.2))} disabled={scale <= 0.5}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">{Math.round(scale * 100)}%</span>
        <Button variant="outline" size="icon" className="h-8 w-8"
          onClick={() => setScale(Math.min(3, scale + 0.2))} disabled={scale >= 3}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* PDF Canvases — all pages rendered vertically */}
      <div className="flex flex-col items-center gap-4">
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <div key={pageNum} className="shadow-lg border bg-white">
            <canvas
              ref={(el) => {
                if (el) {
                  canvasRefs.current.set(pageNum, el);
                } else {
                  canvasRefs.current.delete(pageNum);
                }
              }}
              className="block"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main DedicatedViewer Component
// MODUL 63: Two rendering paths — Default (fast) and High-Fidelity (PDF)
// ============================================================
export function DedicatedViewer({
  nodeId,
  name,
  mimeType,
  previewType,
  previewTier,
  mimeLabel,
  sizeBytes,
  checksumSha256,
}: DedicatedViewerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // MODUL 64.2: Default to high-fidelity (LibreOffice → PDF) for office types
  // This is the confirmed accurate path — user no longer needs to click manually
  const [hiFiMode, setHiFiMode] = useState<boolean>(() => HI_FI_TYPES.includes(previewType));
  const [hiFiError, setHiFiError] = useState<string | null>(null);

  // Whether this file type supports high-fidelity rendering
  const supportsHiFi = HI_FI_TYPES.includes(previewType);

  // DOCX state
  const [mammothHtml, setMammothHtml] = useState<string | null>(null);
  const [docxRenderMethod, setDocxRenderMethod] = useState<'docx-preview' | 'mammoth' | null>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  // XLSX state
  const [spreadsheetData, setSpreadsheetData] = useState<{
    sheetNames: string[];
    sheets: Record<string, { rows: Record<string, string | number | boolean | null>[]; headers: string[] }>;
  } | null>(null);

  // PPTX state
  const [presentationData, setPresentationData] = useState<{
    slideTexts: string[];
    totalSlides: number;
  } | null>(null);

  // Text/Code state
  const [textContent, setTextContent] = useState<string | null>(null);

  // URLs — all same-origin, session-authenticated
  const contentUrl = `/api/files/${nodeId}/content`;
  const previewUrl = `/api/preview/${nodeId}`;
  const downloadUrl = `/api/files/${nodeId}/content?download=true`;
  const convertPdfUrl = `/api/files/${nodeId}/convert-pdf`;

  // ---- High-Fidelity toggle handler ----
  const handleHiFiToggle = () => {
    if (hiFiMode) {
      // Switch to fast mode (secondary)
      setHiFiMode(false);
      setHiFiError(null);
    } else {
      // Switch to high-fidelity mode (default)
      setHiFiMode(true);
      setHiFiError(null);
    }
  };

  // ---- Tier 1: Text/Code loading ----
  useEffect(() => {
    if (previewType !== 'text' && previewType !== 'code') return;

    let cancelled = false;
    const loadText = async () => {
      try {
        const res = await fetch(contentUrl, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Failed to fetch file content (${res.status})`);
        const text = await res.text();
        if (!cancelled) {
          setTextContent(text);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load text content');
          setLoading(false);
        }
      }
    };
    loadText();
    return () => { cancelled = true; };
  }, [contentUrl, previewType]);

  // ---- Tier 1: Image/Video/Audio — loading is instant ----
  useEffect(() => {
    if (previewType === 'image' || previewType === 'video' || previewType === 'audio') {
      setLoading(false);
    }
  }, [previewType]);

  // ---- Tier 1: PDF — handled by PdfPreview sub-component ----
  useEffect(() => {
    if (previewType === 'pdf') {
      setLoading(false); // PdfPreview handles its own loading
    }
  }, [previewType]);

  // ---- DOCX loading (Tier 2 — docx-preview PRIMARY, mammoth fallback) ----
  // MODUL 62: Full docx-preview config flags
  useEffect(() => {
    if (previewType !== 'docx') return;
    let cancelled = false;

    const loadDocx = async () => {
      try {
        const res = await fetch(contentUrl, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Failed to fetch document (${res.status})`);
        const arrayBuffer = await res.arrayBuffer();

        // PRIMARY: docx-preview — preserves images, headings, tables, lists, formatting
        // MODUL 62: Full config flags for maximum fidelity
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
              setDocxRenderMethod('docx-preview');
              setLoading(false);
            }
            return;
          }
        } catch (docxPreviewErr) {
          console.warn('[DedicatedViewer] docx-preview failed, falling back to mammoth:', docxPreviewErr);
        }

        // FALLBACK: mammoth — semantic HTML conversion (may lose images/formatting)
        if (!cancelled) {
          try {
            const mammoth = await import('mammoth');
            const result = await mammoth.convertToHtml({ arrayBuffer });
            if (!cancelled) {
              setMammothHtml(result.value);
              setDocxRenderMethod('mammoth');
              setLoading(false);
            }
          } catch (mammothErr) {
            console.error('[DedicatedViewer] mammoth fallback also failed:', mammothErr);
            if (!cancelled) {
              setError('Failed to render document preview. Both docx-preview and mammoth failed.');
              setLoading(false);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load document file');
          setLoading(false);
        }
      }
    };
    loadDocx();
    return () => { cancelled = true; };
  }, [contentUrl, previewType]);

  // ---- XLSX loading (Tier 2 — SheetJS client-side) ----
  useEffect(() => {
    if (previewType !== 'xlsx') return;
    let cancelled = false;

    const loadXlsx = async () => {
      try {
        const res = await fetch(contentUrl, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Failed to fetch spreadsheet (${res.status})`);
        const arrayBuffer = await res.arrayBuffer();

        const XLSX = await import('xlsx');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetNames = workbook.SheetNames;
        const sheets: Record<string, { rows: Record<string, string | number | boolean | null>[]; headers: string[] }> = {};

        for (const sheetName of sheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;
          // raw: false → computed values (not formula strings)
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number | boolean | null>>(worksheet, { defval: null, raw: false });
          const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
          sheets[sheetName] = { rows: jsonData.slice(0, 200), headers };
        }

        if (!cancelled) {
          setSpreadsheetData({ sheetNames, sheets });
          setLoading(false);
        }
      } catch (err) {
        console.error('[DedicatedViewer] XLSX load error:', err);
        if (!cancelled) {
          setError('Failed to load spreadsheet preview. The file may be corrupted or password-protected.');
          setLoading(false);
        }
      }
    };
    loadXlsx();
    return () => { cancelled = true; };
  }, [contentUrl, previewType]);

  // ---- PPTX loading (Tier 3 — server-side JSON) ----
  useEffect(() => {
    if (previewType !== 'pptx') return;
    let cancelled = false;

    const loadPptx = async () => {
      try {
        const res = await fetch(previewUrl, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Failed to load presentation preview (${res.status})`);
        const data = await res.json();
        if (!cancelled) {
          if (data.success && data.data) {
            setPresentationData({ slideTexts: data.data.slideTexts || [], totalSlides: data.data.totalSlides || 0 });
          } else {
            setError('No preview data available for this presentation');
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('[DedicatedViewer] PPTX load error:', err);
        if (!cancelled) {
          setError('Failed to load presentation preview');
          setLoading(false);
        }
      }
    };
    loadPptx();
    return () => { cancelled = true; };
  }, [previewUrl, previewType]);

  // ---- MODUL 64.5: High-Fidelity mode loading ----
  // The PdfPreview sub-component handles its own loading state (pdfLoading)
  // with explicit progress indicators for cache-miss scenarios.
  // No additional loading state needed here — PdfPreview shows its own
  // "Mengkonversi dokumen ke PDF…" indicator during first-time conversion.

  // ---- Close/back handler ----
  const handleClose = () => {
    if (window.opener) { window.close(); } else { router.back(); }
  };

  // ---- Icon selection ----
  const getIcon = () => {
    switch (previewType) {
      case 'image': return <span className="text-lg">🖼️</span>;
      case 'video': return <span className="text-lg">🎬</span>;
      case 'audio': return <span className="text-lg">🎵</span>;
      case 'pdf': return <FileText className="h-5 w-5 text-red-500" />;
      case 'text': return <FileText className="h-5 w-5 text-gray-500" />;
      case 'code': return <FileText className="h-5 w-5 text-emerald-500" />;
      case 'docx': return <FileText className="h-5 w-5 text-blue-500" />;
      case 'xlsx': return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
      case 'pptx': return <Presentation className="h-5 w-5 text-orange-500" />;
      default: return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  // ---- Error rendering ----
  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* MODUL 65: Header reuses dark-theme tokens from app-shell */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleClose} className="text-foreground"><ArrowLeft className="h-5 w-5" /></Button>
            <span className="font-medium truncate max-w-[50vw] text-foreground">{name}</span>
          </div>
          <div className="flex items-center gap-2">
            {supportsHiFi && (
              <Button variant="outline" size="sm" onClick={handleHiFiToggle}>
                {hiFiMode ? <><Zap className="h-4 w-4 mr-2" />Tampilan Cepat</> : <><Eye className="h-4 w-4 mr-2" />Tampilan Asli (PDF)</>}
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={downloadUrl} download={name}><Download className="h-4 w-4 mr-2" />Download</a>
            </Button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground text-center">{error}</p>
              <div className="flex items-center gap-2">
                {supportsHiFi && (
                  <Button variant="outline" size="sm" onClick={handleHiFiToggle}>
                    {hiFiMode ? <><Zap className="h-4 w-4 mr-2" />Tampilan Cepat</> : <><Eye className="h-4 w-4 mr-2" />Tampilan Asli (PDF)</>}
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <a href={downloadUrl} download={name}><Download className="h-4 w-4 mr-2" />Download</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---- Main rendering ----
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* MODUL 65: Toolbar — reuses dark-theme tokens from app-shell */}
      {/* 65.5: z-30 ensures header stays above canvas-rendered content in both modes */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* 65.4: Explicit gap-3 between element groups */}
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={handleClose} className="text-foreground shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
          <span className="shrink-0">{getIcon()}</span>
          {/* 65.3: File name with proper foreground contrast */}
          <span className="font-medium truncate max-w-[40vw] text-foreground">{name}</span>
          {/* 65.4: Size badge with explicit spacing */}
          {sizeBytes > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">{formatFileSize(sizeBytes)}</span>
          )}
          {/* 65.4: Type badge with explicit spacing */}
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">{mimeLabel}</span>
          {/* Hi-Fi mode indicator */}
          {hiFiMode && supportsHiFi && (
            <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium shrink-0">
              Tampilan Asli
            </span>
          )}
        </div>
        {/* 65.4: Right side with explicit gap */}
        <div className="flex items-center gap-2 shrink-0">
          {/* MODUL 64.3: Toggle between High-Fidelity (default) and Fast (secondary) */}
          {supportsHiFi && (
            <Button
              variant={hiFiMode ? 'default' : 'outline'}
              size="sm"
              onClick={handleHiFiToggle}
              title={hiFiMode ? 'Beralih ke tampilan cepat (ringan, tanpa konversi)' : 'Beralih ke tampilan asli (PDF) — presisi tinggi via LibreOffice'}
            >
              {hiFiMode ? (
                <><Zap className="h-4 w-4 mr-2" />Tampilan Cepat</>
              ) : (
                <><Eye className="h-4 w-4 mr-2" />Tampilan Asli (PDF)</>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={downloadUrl} download={name}><Download className="h-4 w-4 mr-2" />Download</a>
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {/* ---- MODUL 64.5: High-Fidelity Mode with explicit loading for cache-miss ---- */}
        {hiFiMode && supportsHiFi ? (
          <div className="flex items-center justify-center p-6">
            <PdfPreview contentUrl={convertPdfUrl} />
          </div>
        ) : loading ? (
          /* ---- Loading state ---- */
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-sm text-muted-foreground">Loading…</span>
          </div>
        ) : previewType === 'image' ? (
          /* Image — centered, max-width A4 style */
          <div className="flex items-center justify-center p-6 min-h-[80vh] bg-muted/30">
            <img
              src={contentUrl}
              alt={name}
              className="max-w-[210mm] max-h-[80vh] object-contain rounded-lg shadow-md bg-white dark:bg-neutral-800"
            />
          </div>
        ) : previewType === 'video' ? (
          /* Video — centered player */
          <div className="flex items-center justify-center p-6 min-h-[80vh]">
            <video
              src={contentUrl}
              controls
              autoPlay
              className="max-w-[210mm] rounded-lg shadow-md"
              style={{ maxHeight: '80vh' }}
            >
              Your browser does not support video playback.
            </video>
          </div>
        ) : previewType === 'audio' ? (
          /* Audio — centered player with visual wrapper */
          <div className="flex flex-col items-center justify-center p-6 min-h-[80vh]">
            <div className="w-full max-w-[210mm] bg-card rounded-lg shadow-md p-8 flex flex-col items-center gap-6">
              <span className="text-4xl">🎵</span>
              <h2 className="text-lg font-medium text-card-foreground">{name}</h2>
              <audio src={contentUrl} controls autoPlay className="w-full" />
            </div>
          </div>
        ) : previewType === 'pdf' ? (
          /* PDF — canvas rendering with zoom controls */
          <div className="flex items-center justify-center p-6">
            <PdfPreview contentUrl={contentUrl} />
          </div>
        ) : previewType === 'text' || previewType === 'code' ? (
          /* Text/Code — A4-style document view */
          <div className="flex justify-center p-6">
            <div className="w-full max-w-[210mm] min-h-[297mm] bg-card rounded-lg shadow-md p-[20mm] font-mono text-sm leading-relaxed overflow-auto whitespace-pre-wrap break-words border text-card-foreground">
              {textContent}
            </div>
          </div>
        ) : previewType === 'docx' ? (
          /* DOCX — docx-preview (primary) or mammoth (fallback) */
          docxRenderMethod === 'mammoth' && mammothHtml ? (
            <div className="flex justify-center p-6">
              <div
                className="w-full max-w-[210mm] min-h-[297mm] bg-card rounded-lg shadow-md p-[20mm] overflow-auto border text-card-foreground"
                dangerouslySetInnerHTML={{ __html: mammothHtml }}
              />
            </div>
          ) : (
            <div className="flex justify-center p-6">
              <div className="docx-preview-wrapper w-full max-w-[210mm] min-h-[297mm] bg-card rounded-lg shadow-md overflow-auto border text-card-foreground">
                <div ref={docxContainerRef} className="w-full" />
              </div>
            </div>
          )
        ) : previewType === 'xlsx' ? (
          /* XLSX — SheetJS with multi-sheet tab switcher */
          spreadsheetData ? (
            <div className="p-6 max-w-full mx-auto">
              <SpreadsheetPreview data={spreadsheetData} name={name} />
            </div>
          ) : null
        ) : previewType === 'pptx' ? (
          /* PPTX — server-side extracted text */
          presentationData ? (
            <div className="p-6 max-w-[210mm] mx-auto">
              <PresentationPreview data={presentationData} />
            </div>
          ) : null
        ) : (
          /* Unknown/unsupported type — offer download */
          <div className="flex flex-col items-center justify-center p-6 min-h-[80vh]">
            <Card className="w-full max-w-md">
              <CardContent className="p-6 flex flex-col items-center gap-4">
                {getIcon()}
                <h3 className="font-medium">{name}</h3>
                <p className="text-sm text-muted-foreground">
                  This file type ({mimeLabel}) cannot be previewed directly.
                </p>
                <Button variant="default" size="sm" asChild>
                  <a href={downloadUrl} download={name}><Download className="h-4 w-4 mr-2" />Download to View</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
