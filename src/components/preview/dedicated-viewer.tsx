'use client';

// ============================================================
// Dedicated New-Tab Viewer — ALL file types supported
// Opens in a new browser tab like Google Drive.
// No download prompt — file opens directly.
// A4-paper-style rendering for documents.
//
// Supported:
//   Tier 1 (native browser): image, video, audio, PDF, text/code
//   Tier 2 (client-side): docx, xlsx
//   Tier 3 (server-side): pptx
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
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
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { formatFileSize } from '@/lib/mime-icons';
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
  publicAccessToken: string;
}

// ============================================================
// Spreadsheet Preview Sub-component
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
  const maxRows = 100;

  if (!sheetData) {
    return <p className="text-sm text-muted-foreground">No data found in spreadsheet</p>;
  }

  return (
    <div className="flex flex-col w-full">
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

      <div className="overflow-auto max-h-[70vh] border rounded-lg">
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
// ============================================================
function PdfPreview({ contentUrl }: { contentUrl: string }) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<unknown>(null);
  const [scale, setScale] = useState(1.2);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const res = await fetch(contentUrl);
        if (!res.ok) throw new Error('Failed to fetch PDF');
        const arrayBuffer = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        if (!cancelled) {
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error('PDF load error:', err);
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [contentUrl]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    setRendering(true);

    try {
      const pdfjsLib = await import('pdfjs-dist');
      const page = await (pdfDoc as { getPage: (n: number) => Promise<unknown> }).getPage(pageNum);
      const viewport = (page as { getViewport: (opts: { scale: number }) => { width: number; height: number } }).getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = { canvasContext: context, viewport };
      await (page as { render: (ctx: unknown) => Promise<unknown> }).render(renderContext).promise;
    } catch (err) {
      console.error('PDF render error:', err);
    } finally {
      setRendering(false);
    }
  }, [pdfDoc, scale]);

  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, renderPage]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* PDF Navigation */}
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" size="icon" className="h-8 w-8"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1 || rendering}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {numPages}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8"
          onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages || rendering}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="mx-2 text-muted-foreground">|</span>
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

      {/* PDF Canvas — centered with A4-like styling */}
      <div className="shadow-lg border bg-white overflow-auto max-h-[80vh] w-auto">
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
}

// ============================================================
// Main DedicatedViewer Component
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
  publicAccessToken,
}: DedicatedViewerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DOCX state
  const [mammothHtml, setMammothHtml] = useState<string | null>(null);
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

  // URLs
  const contentUrl = `/api/files/${nodeId}/content`;
  const previewUrl = `/api/preview/${nodeId}`;
  const downloadUrl = `/api/files/${nodeId}/content?download=true`;

  // Whether to show Google Docs button (only for office types)
  const showGoogleDocsButton = previewType === 'docx' || previewType === 'xlsx' || previewType === 'pptx';

  const handleOpenGoogleDocs = () => {
    const publicContentUrl = `${window.location.origin}/api/files/${nodeId}/public-content?token=${encodeURIComponent(publicAccessToken)}`;
    const googleDocsViewerUrl = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(publicContentUrl)}`;
    window.open(googleDocsViewerUrl, '_blank');
  };

  // ---- Tier 1: Text/Code loading ----
  useEffect(() => {
    if (previewType !== 'text' && previewType !== 'code') return;

    let cancelled = false;
    const loadText = async () => {
      try {
        const res = await fetch(contentUrl);
        if (!res.ok) throw new Error('Failed to fetch file content');
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

  // ---- DOCX loading ----
  useEffect(() => {
    if (previewType !== 'docx') return;
    let cancelled = false;

    const loadDocx = async () => {
      try {
        const res = await fetch(contentUrl);
        if (!res.ok) throw new Error('Failed to fetch document');
        const arrayBuffer = await res.arrayBuffer();

        try {
          const docxPreview = await import('docx-preview');
          if (docxContainerRef.current && !cancelled) {
            await docxPreview.renderAsync(arrayBuffer, docxContainerRef.current, undefined, { className: 'docx-preview-wrapper' });
            if (!cancelled) setLoading(false);
            return;
          }
        } catch {
          console.warn('docx-preview failed, falling back to mammoth');
        }

        if (!cancelled) {
          const mammoth = await import('mammoth');
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (!cancelled) { setMammothHtml(result.value); setLoading(false); }
        }
      } catch (err) {
        if (!cancelled) { setError('Failed to load document preview'); setLoading(false); }
      }
    };
    loadDocx();
    return () => { cancelled = true; };
  }, [contentUrl, previewType]);

  // ---- XLSX loading ----
  useEffect(() => {
    if (previewType !== 'xlsx') return;
    let cancelled = false;

    const loadXlsx = async () => {
      try {
        const res = await fetch(contentUrl);
        if (!res.ok) throw new Error('Failed to fetch spreadsheet');
        const arrayBuffer = await res.arrayBuffer();
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetNames = workbook.SheetNames;
        const sheets: Record<string, { rows: Record<string, string | number | boolean | null>[]; headers: string[] }> = {};

        for (const sheetName of sheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number | boolean | null>>(worksheet, { defval: null });
          const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
          sheets[sheetName] = { rows: jsonData.slice(0, 100), headers };
        }
        if (!cancelled) { setSpreadsheetData({ sheetNames, sheets }); setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError('Failed to load spreadsheet preview'); setLoading(false); }
      }
    };
    loadXlsx();
    return () => { cancelled = true; };
  }, [contentUrl, previewType]);

  // ---- PPTX loading ----
  useEffect(() => {
    if (previewType !== 'pptx') return;
    let cancelled = false;

    const loadPptx = async () => {
      try {
        const res = await fetch(previewUrl);
        if (!res.ok) throw new Error('Failed to load presentation preview');
        const data = await res.json();
        if (!cancelled) {
          if (data.success && data.data) {
            setPresentationData({ slideTexts: data.data.slideTexts || [], totalSlides: data.data.totalSlides || 0 });
          } else { setError('No preview data available'); }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) { setError('Failed to load presentation preview'); setLoading(false); }
      }
    };
    loadPptx();
    return () => { cancelled = true; };
  }, [previewUrl, previewType]);

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
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleClose}><ArrowLeft className="h-5 w-5" /></Button>
            <span className="font-medium truncate max-w-[50vw]">{name}</span>
          </div>
          <div className="flex items-center gap-2">
            {showGoogleDocsButton && (
              <Button variant="outline" size="sm" onClick={handleOpenGoogleDocs}>
                <ExternalLink className="h-4 w-4 mr-2" />Google Docs
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
              {getIcon()}
              <p className="text-sm text-muted-foreground">{error}</p>
              <div className="flex items-center gap-2">
                {showGoogleDocsButton && (
                  <Button variant="outline" size="sm" onClick={handleOpenGoogleDocs}>
                    <ExternalLink className="h-4 w-4 mr-2" />Google Docs
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
      {/* Toolbar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleClose}><ArrowLeft className="h-5 w-5" /></Button>
          {getIcon()}
          <span className="font-medium truncate max-w-[50vw]">{name}</span>
          {sizeBytes > 0 && <span className="text-sm text-muted-foreground">{formatFileSize(sizeBytes)}</span>}
          <span className="text-xs text-muted-foreground">{mimeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {showGoogleDocsButton && (
            <Button variant="outline" size="sm" onClick={handleOpenGoogleDocs}>
              <ExternalLink className="h-4 w-4 mr-2" />Google Docs
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={downloadUrl} download={name}><Download className="h-4 w-4 mr-2" />Download</a>
          </Button>
        </div>
      </div>

      {/* Content area — A4-paper style for documents */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-sm text-muted-foreground">Loading…</span>
          </div>
        ) : previewType === 'image' ? (
          /* Image — centered, max-width A4 style */
          <div className="flex items-center justify-center p-6 min-h-[80vh]">
            <img
              src={contentUrl}
              alt={name}
              className="max-w-[210mm] max-h-[80vh] object-contain rounded-lg shadow-md bg-white"
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
            <div className="w-full max-w-[210mm] bg-white rounded-lg shadow-md p-8 flex flex-col items-center gap-6">
              <span className="text-4xl">🎵</span>
              <h2 className="text-lg font-medium">{name}</h2>
              <audio src={contentUrl} controls autoPlay className="w-full" />
            </div>
          </div>
        ) : previewType === 'pdf' ? (
          /* PDF — canvas rendering with page navigation */
          <div className="flex items-center justify-center p-6">
            <PdfPreview contentUrl={contentUrl} />
          </div>
        ) : previewType === 'text' || previewType === 'code' ? (
          /* Text/Code — A4-style document view */
          <div className="flex justify-center p-6">
            <div className="w-full max-w-[210mm] bg-white rounded-lg shadow-md p-[20mm] font-mono text-sm leading-relaxed overflow-auto whitespace-pre-wrap break-words border">
              {textContent}
            </div>
          </div>
        ) : previewType === 'docx' ? (
          mammothHtml ? (
            <div className="flex justify-center p-6">
              <div
                className="w-full max-w-[210mm] bg-white rounded-lg shadow-md p-[20mm] overflow-auto prose prose-sm dark:prose-invert border"
                dangerouslySetInnerHTML={{ __html: mammothHtml }}
              />
            </div>
          ) : (
            <div className="flex justify-center p-6">
              <div ref={docxContainerRef} className="w-full max-w-[210mm] bg-white rounded-lg shadow-md overflow-auto border" />
            </div>
          )
        ) : previewType === 'xlsx' ? (
          spreadsheetData ? (
            <div className="p-6 max-w-[210mm] mx-auto">
              <SpreadsheetPreview data={spreadsheetData} name={name} />
            </div>
          ) : null
        ) : previewType === 'pptx' ? (
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
