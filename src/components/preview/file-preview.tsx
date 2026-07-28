'use client';

// ============================================================
// MODUL 7: File Preview Component
// Renders file preview based on MIME type:
// - Images: <img> with lazy loading and spinner
// - PDFs: embedded iframe viewer
// - Videos: <video> tag with controls and preload="metadata"
// - Audio: simple audio tag
// - Text/Code: syntax-highlighted text preview (fetches from API)
// - Office docs: docx→HTML in iframe, xlsx→table, pptx→slide content
// - Unsupported: fallback icon + file name + size + download button
// ============================================================

import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { getMimePreviewType, getMimeIcon, getMimeLabel, formatFileSize, type PreviewType, type IconName } from '@/lib/mime-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface FilePreviewProps {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
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
  const maxRows = 100; // Limit displayed rows for performance

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
// Main FilePreview Component
// ============================================================
export function FilePreview({ id, name, mimeType, sizeBytes, onClose }: FilePreviewProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [textContent, setTextContent] = useState<string>('');
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState(false);

  // Office document state
  const [officeLoading, setOfficeLoading] = useState(false);
  const [officeError, setOfficeError] = useState(false);
  const [officeSubType, setOfficeSubType] = useState<'docx' | 'xlsx' | 'pptx' | 'unknown' | null>(null);
  const [spreadsheetData, setSpreadsheetData] = useState<{
    sheetNames: string[];
    sheets: Record<string, { rows: Record<string, string | number | boolean | null>[]; headers: string[] }>;
  } | null>(null);
  const [presentationData, setPresentationData] = useState<{
    slideTexts: string[];
    totalSlides: number;
  } | null>(null);
  const [docxConversionError, setDocxConversionError] = useState(false);

  const previewType = getMimePreviewType(mimeType);
  const iconName = getMimeIcon(mimeType);
  const mimeLabel = getMimeLabel(mimeType);
  const IconComponent = ICON_COMPONENTS[iconName] || FileQuestion;

  const previewUrl = `/api/preview/${id}`;
  const downloadUrl = `/api/upload/download/${id}`;

  // Fetch text content for text/code preview
  useEffect(() => {
    if (previewType === 'text') {
      let cancelled = false;
      const loadText = async () => {
        try {
          const res = await fetch(previewUrl);
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

  // Fetch office document data for xlsx/pptx preview
  useEffect(() => {
    if (previewType === 'office') {
      let cancelled = false;
      const loadOfficeData = async () => {
        try {
          const res = await fetch(previewUrl);
          if (!res.ok) throw new Error('Failed to load office preview');
          const data = await res.json();
          if (!cancelled) {
            if (data.success && data.data) {
              const subType = data.data.officeSubType;
              setOfficeSubType(subType);

              if (subType === 'xlsx' && data.data.sheets) {
                setSpreadsheetData({
                  sheetNames: data.data.sheetNames,
                  sheets: data.data.sheets,
                });
              } else if (subType === 'pptx') {
                setPresentationData({
                  slideTexts: data.data.slideTexts || [],
                  totalSlides: data.data.totalSlides || 0,
                });
              } else if (subType === 'docx' && data.data.conversionError) {
                setDocxConversionError(true);
              }
            } else {
              setOfficeError(true);
            }
          }
        } catch {
          if (!cancelled) {
            setOfficeError(true);
          }
        }
      };
      setOfficeLoading(true);
      setOfficeError(false);
      loadOfficeData().finally(() => {
        if (!cancelled) setOfficeLoading(false);
      });
      return () => { cancelled = true; };
    }
  }, [previewType, previewUrl]);

  // Determine docx sub-type from mimeType (for iframe rendering)
  const isDocx = mimeType.includes('wordprocessingml') || mimeType.includes('msword');

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

  // --- Image Preview ---
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
            src={previewUrl}
            alt={name}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
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
        </div>
      </div>
    );
  }

  // --- PDF Preview ---
  if (previewType === 'pdf') {
    return (
      <div className="relative flex flex-col w-full">
        {closeButton}
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-5 w-5 text-red-500" />
          <span className="font-medium truncate max-w-xs">{name}</span>
          {sizeBytes && (
            <span className="text-sm text-muted-foreground">{formatFileSize(sizeBytes)}</span>
          )}
          <Button variant="outline" size="sm" asChild className="ml-auto">
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in new tab
            </a>
          </Button>
        </div>
        <iframe
          src={previewUrl}
          className="w-full rounded-lg border bg-white"
          style={{ minHeight: '500px', maxHeight: '70vh' }}
          title={`Preview of ${name}`}
        />
      </div>
    );
  }

  // --- Video Preview ---
  if (previewType === 'video') {
    return (
      <div className="relative flex flex-col items-center w-full">
        {closeButton}
        <video
          src={previewUrl}
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
        </div>
      </div>
    );
  }

  // --- Audio Preview ---
  if (previewType === 'audio') {
    return (
      <div className="relative flex flex-col items-center w-full p-6">
        {closeButton}
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Music className="h-8 w-8 text-muted-foreground" />
        </div>
        <span className="font-medium truncate max-w-xs mb-2">{name}</span>
        <audio
          src={previewUrl}
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
        </div>
      </div>
    );
  }

  // --- Text/Code Preview ---
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
          <div className="relative rounded-lg border bg-muted/30 overflow-hidden">
            <pre className="p-4 text-sm font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap break-words leading-relaxed">
              {textContent}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // --- Office Document Preview (docx, xlsx, pptx) ---
  if (previewType === 'office') {
    return (
      <div className="relative flex flex-col w-full">
        {closeButton}
        <div className="flex items-center gap-2 mb-3">
          {isDocx ? (
            <FileText className="h-5 w-5 text-blue-500" />
          ) : mimeType.includes('spreadsheet') ? (
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
          ) : (
            <Presentation className="h-5 w-5 text-orange-500" />
          )}
          <span className="font-medium truncate max-w-xs">{name}</span>
          {sizeBytes && (
            <span className="text-sm text-muted-foreground">{formatFileSize(sizeBytes)}</span>
          )}
          <span className="text-xs text-muted-foreground">{mimeLabel}</span>
        </div>

        {/* Loading state */}
        {officeLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading preview...</span>
          </div>
        )}

        {/* Error state */}
        {officeError && !officeLoading && (
          <Card className="w-full">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <IconComponent className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Failed to load document preview</p>
              <Button variant="outline" size="sm" asChild>
                <a href={downloadUrl} download={name}>
                  <Download className="h-4 w-4 mr-2" />
                  Download to open
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* DOCX preview — rendered as HTML in iframe */}
        {isDocx && !officeLoading && !officeError && (
          <div className="w-full">
            <iframe
              src={previewUrl}
              className="w-full rounded-lg border bg-white"
              style={{ minHeight: '500px', maxHeight: '70vh' }}
              title={`Preview of ${name}`}
              sandbox="allow-same-origin"
            />
          </div>
        )}

        {/* XLSX preview — rendered as interactive table */}
        {officeSubType === 'xlsx' && spreadsheetData && !officeLoading && !officeError && (
          <SpreadsheetPreview data={spreadsheetData} name={name} />
        )}

        {/* PPTX preview — rendered as slide cards */}
        {officeSubType === 'pptx' && presentationData && !officeLoading && !officeError && (
          <PresentationPreview data={presentationData} name={name} />
        )}

        {/* Conversion error fallback for docx */}
        {docxConversionError && !officeLoading && (
          <Card className="w-full">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Could not convert document for preview</p>
              <Button variant="outline" size="sm" asChild>
                <a href={downloadUrl} download={name}>
                  <Download className="h-4 w-4 mr-2" />
                  Download to open
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
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
