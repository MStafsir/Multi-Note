'use client';

// ============================================================
// MODUL 54.5: Dedicated New-Tab Viewer — Client Component
// Renders Tier 2 (DOCX/XLSX) and Tier 3 (PPTX) files in a
// full-page dedicated viewer opened in a new browser tab.
//
// Rendering:
//   - DOCX: docx-preview renderAsync() → fallback mammoth convertToHtml()
//   - XLSX: SheetJS (xlsx) client-side parse → SpreadsheetPreview
//   - PPTX: fetch JSON from /api/preview/[nodeId] → PresentationPreview
//
// Toolbar:
//   - File name display
//   - Close/back button (window.close() if opener exists, router.back() fallback)
//   - Download button → /api/files/[nodeId]/content?download=true
//   - "Open with Google Docs" button (DOCX/XLSX/PPTX) → public-content endpoint
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
  ExternalLink,
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
// Spreadsheet Preview Sub-component (reused from file-preview.tsx)
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
// Presentation Preview Sub-component (reused from file-preview.tsx)
// ============================================================
function PresentationPreview({ data }: {
  data: {
    slideTexts: string[];
    totalSlides: number;
  };
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

  // Common state
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

  // URLs
  const contentUrl = `/api/files/${nodeId}/content`;
  const previewUrl = `/api/preview/${nodeId}`;
  const downloadUrl = `/api/files/${nodeId}/content?download=true`;

  // Whether to show the Google Docs button (only for office file types)
  const showGoogleDocsButton = previewType === 'docx' || previewType === 'xlsx' || previewType === 'pptx';

  // Handler for opening Google Docs Viewer — computed lazily to avoid SSR window crash
  const handleOpenGoogleDocs = () => {
    // Build the public-content URL with the temporary token
    const publicContentUrl = `${window.location.origin}/api/files/${nodeId}/public-content?token=${encodeURIComponent(publicAccessToken)}`;
    const googleDocsViewerUrl = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(publicContentUrl)}`;
    window.open(googleDocsViewerUrl, '_blank');
  };

  // ---- DOCX loading ----
  useEffect(() => {
    if (previewType !== 'docx') return;

    let cancelled = false;

    const loadDocx = async () => {
      try {
        const res = await fetch(contentUrl);
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
              { className: 'docx-preview-wrapper' }
            );
            if (!cancelled) {
              setLoading(false);
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

          sheets[sheetName] = {
            rows: jsonData.slice(0, 100),
            headers,
          };
        }

        if (!cancelled) {
          setSpreadsheetData({ sheetNames, sheets });
          setLoading(false);
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
            setPresentationData({
              slideTexts: data.data.slideTexts || [],
              totalSlides: data.data.totalSlides || 0,
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
  }, [previewUrl, previewType]);

  // ---- Close/back handler ----
  const handleClose = () => {
    // window.close() only works if the window was opened by window.open()
    // (i.e., window.opener exists). Otherwise, fall back to router.back()
    if (window.opener) {
      window.close();
    } else {
      router.back();
    }
  };

  // ---- Icon selection by preview type ----
  const getIcon = () => {
    if (previewType === 'docx') return <FileText className="h-5 w-5 text-blue-500" />;
    if (previewType === 'xlsx') return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
    if (previewType === 'pptx') return <Presentation className="h-5 w-5 text-orange-500" />;
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  // ---- Error rendering ----
  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Toolbar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Go back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-medium truncate max-w-[50vw]">{name}</span>
          </div>
          <div className="flex items-center gap-2">
            {showGoogleDocsButton && (
              <Button variant="outline" size="sm" onClick={handleOpenGoogleDocs}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Google Docs
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={downloadUrl} download={name}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        </div>

        {/* Error content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              {getIcon()}
              <p className="text-sm text-muted-foreground">{error}</p>
              <div className="flex items-center gap-2">
                {showGoogleDocsButton && (
                  <Button variant="outline" size="sm" onClick={handleOpenGoogleDocs}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Google Docs
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <a href={downloadUrl} download={name}>
                    <Download className="h-4 w-4 mr-2" />
                    Download to open
                  </a>
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
      {/* MODUL 54.6: Minimal Toolbar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {getIcon()}
          <span className="font-medium truncate max-w-[50vw]">{name}</span>
          {sizeBytes > 0 && (
            <span className="text-sm text-muted-foreground">{formatFileSize(sizeBytes)}</span>
          )}
          <span className="text-xs text-muted-foreground">{mimeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {showGoogleDocsButton && (
            <Button variant="outline" size="sm" onClick={handleOpenGoogleDocs}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Google Docs
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={downloadUrl} download={name}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </a>
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 p-6 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-sm text-muted-foreground">
              Loading {previewType === 'docx' ? 'document' : previewType === 'xlsx' ? 'spreadsheet' : 'presentation'}…
            </span>
          </div>
        ) : previewType === 'docx' ? (
          mammothHtml ? (
            <div
              className="w-full rounded-lg border bg-white p-6 overflow-auto prose prose-sm dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: mammothHtml }}
            />
          ) : (
            <div
              ref={docxContainerRef}
              className="w-full rounded-lg border bg-white overflow-auto"
            />
          )
        ) : previewType === 'xlsx' ? (
          spreadsheetData ? (
            <SpreadsheetPreview data={spreadsheetData} name={name} />
          ) : null
        ) : previewType === 'pptx' ? (
          presentationData ? (
            <PresentationPreview data={presentationData} />
          ) : null
        ) : (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              Preview not available for this file type. Please download to view.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
