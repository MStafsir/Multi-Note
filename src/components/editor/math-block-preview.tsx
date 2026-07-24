// ============================================================
// MODUL 45.3/45.4: MathBlock Live Preview Component
// Shows rendered KaTeX output, toggles between source/edit/preview modes
// Graceful error handling: shows raw source with inline error indicator
// Never crashes — uses try/catch and fallback rendering per 45.4
// ============================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { renderMathToHtml } from '@/lib/katex-renderer';
import { AlertTriangle, Code2, Eye, Columns2, X } from 'lucide-react';

// View modes for the math block preview
type MathViewMode = 'rendered' | 'source' | 'live_preview';

interface MathBlockPreviewProps {
  /** LaTeX source string */
  source: string;
  /** Display mode: 'inline' for $...$, 'block' for $$...$$ */
  displayMode: 'inline' | 'block';
  /** Callback when source is updated */
  onSourceChange: (newSource: string) => void;
  /** Whether this is the initially selected state (starts in source mode) */
  isSelected?: boolean;
}

export function MathBlockPreview({
  source,
  displayMode,
  onSourceChange,
  isSelected = false,
}: MathBlockPreviewProps) {
  const [viewMode, setViewMode] = useState<MathViewMode>(
    isSelected ? 'source' : 'rendered'
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const renderedRef = useRef<HTMLDivElement>(null);

  // Render math using KaTeX
  const renderResult = renderMathToHtml(source, displayMode);
  const hasError = renderResult.error !== null;

  // Update rendered output in DOM (avoid re-render overhead)
  useEffect(() => {
    if (renderedRef.current && renderResult.html) {
      renderedRef.current.innerHTML = renderResult.html;
    }
  }, [renderResult.html, viewMode]);

  // Handle textarea input
  const handleSourceEdit = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onSourceChange(e.target.value);
    },
    [onSourceChange]
  );

  // Toggle between modes on click
  const handleToggleMode = useCallback(
    (mode: MathViewMode) => {
      setViewMode(mode);
      if (mode === 'source' && textareaRef.current) {
        // Focus textarea when switching to source mode
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    },
    []
  );

  // Mode buttons for switching between views
  const modeButtons: Array<{
    mode: MathViewMode;
    icon: React.ReactNode;
    label: string;
  }> = [
    { mode: 'rendered', icon: <Eye className="h-3.5 w-3.5" />, label: 'Preview' },
    { mode: 'source', icon: <Code2 className="h-3.5 w-3.5" />, label: 'Source' },
    { mode: 'live_preview', icon: <Columns2 className="h-3.5 w-3.5" />, label: 'Live' },
  ];

  // Inline mode: compact rendering
  if (displayMode === 'inline') {
    return (
      <span className="math-block-inline inline-flex items-center gap-1">
        {viewMode === 'rendered' && (
          <span
            className="cursor-pointer hover:bg-accent/30 rounded px-1 transition-colors"
            onClick={() => handleToggleMode('source')}
            role="button"
            tabIndex={0}
            aria-label="Click to edit math source"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggleMode('source');
              }
            }}
          >
            {renderResult.html ? (
              <span ref={renderedRef} className="katex-inline-output" />
            ) : (
              <span className="text-red-500 underline decoration-wavy text-sm">
                {source}
              </span>
            )}
          </span>
        )}
        {viewMode === 'source' && (
          <span className="inline-flex items-center gap-1 bg-muted/50 rounded px-1 py-0.5">
            <span className="text-muted-foreground text-xs">$</span>
            <input
              type="text"
              value={source}
              onChange={(e) => onSourceChange(e.target.value)}
              className="text-sm bg-transparent border-none outline-none focus:ring-1 focus:ring-ring rounded px-1 min-w-[60px]"
              aria-label="Edit inline LaTeX source"
              autoFocus
            />
            <span className="text-muted-foreground text-xs">$</span>
            <button
              onClick={() => handleToggleMode('rendered')}
              className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close source editor"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        {hasError && viewMode === 'rendered' && (
          <span
            className="inline-flex items-center gap-1 text-red-500 text-xs ml-1"
            role="alert"
            aria-label={renderResult.error || 'LaTeX error'}
          >
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[200px]">{renderResult.error}</span>
          </span>
        )}
      </span>
    );
  }

  // Block mode: full-width rendering with mode switching
  return (
    <div className="math-block-preview my-3 rounded-lg border border-border bg-background overflow-hidden">
      {/* Mode switcher toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground font-medium">
            Math Block
          </span>
          <span className="text-xs text-muted-foreground">
            {displayMode === 'block' ? '$$' : '$'}...{displayMode === 'block' ? '$$' : '$'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {modeButtons.map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => handleToggleMode(mode)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                viewMode === mode
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
              }`}
              aria-label={`Switch to ${label} mode`}
              aria-pressed={viewMode === mode}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content area based on view mode */}
      <div className="math-block-content">
        {/* Rendered view */}
        {viewMode === 'rendered' && (
          <div
            className="px-4 py-3 cursor-pointer hover:bg-accent/10 transition-colors"
            onClick={() => handleToggleMode('source')}
            role="button"
            tabIndex={0}
            aria-label="Click to edit math source"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggleMode('source');
              }
            }}
          >
            {renderResult.html ? (
              <div ref={renderedRef} className="katex-block-output overflow-x-auto" />
            ) : (
              <div className="text-sm text-muted-foreground italic">
                No rendered output available
              </div>
            )}
            {hasError && (
              <div
                className="flex items-center gap-2 mt-2 p-2 rounded bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30"
                role="alert"
              >
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    LaTeX Error
                  </span>
                  <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 break-words">
                    {renderResult.error}
                  </p>
                </div>
              </div>
            )}
            {!hasError && !source.trim() && (
              <div className="text-sm text-muted-foreground italic text-center">
                Click to add LaTeX expression
              </div>
            )}
          </div>
        )}

        {/* Source editing view */}
        {viewMode === 'source' && (
          <div className="px-4 py-3">
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground text-sm mt-2 shrink-0">$$</span>
              <textarea
                ref={textareaRef}
                value={source}
                onChange={handleSourceEdit}
                className="w-full text-sm bg-transparent border border-input rounded-md px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none resize-y min-h-[60px] font-mono"
                placeholder="Enter LaTeX expression, e.g. \frac{1}{2}"
                aria-label="Edit LaTeX source"
                rows={3}
                autoFocus
              />
              <span className="text-muted-foreground text-sm mt-2 shrink-0">$$</span>
            </div>
            {hasError && (
              <div
                className="flex items-center gap-2 mt-2 p-2 rounded bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30"
                role="alert"
              >
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-xs text-red-500 dark:text-red-400 break-words">
                  {renderResult.error}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Live preview view: source + rendered side by side */}
        {viewMode === 'live_preview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-x divide-border">
            {/* Source editor */}
            <div className="px-4 py-3">
              <div className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                <Code2 className="h-3 w-3" />
                Source
              </div>
              <div className="flex items-start gap-1">
                <span className="text-muted-foreground text-xs mt-2 shrink-0">$$</span>
                <textarea
                  ref={textareaRef}
                  value={source}
                  onChange={handleSourceEdit}
                  className="w-full text-sm bg-transparent border border-input rounded-md px-2 py-1.5 focus:ring-2 focus:ring-ring focus:outline-none resize-y min-h-[60px] font-mono"
                  placeholder="Enter LaTeX expression"
                  aria-label="Edit LaTeX source with live preview"
                  rows={3}
                />
                <span className="text-muted-foreground text-xs mt-2 shrink-0">$$</span>
              </div>
            </div>
            {/* Rendered output */}
            <div className="px-4 py-3">
              <div className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Preview
              </div>
              {renderResult.html ? (
                <div ref={renderedRef} className="katex-block-output overflow-x-auto" />
              ) : (
                <div className="text-sm text-muted-foreground italic">
                  No rendered output
                </div>
              )}
              {hasError && (
                <div
                  className="flex items-center gap-2 mt-2 p-2 rounded bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30"
                  role="alert"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-500 dark:text-red-400 break-words">
                    {renderResult.error}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
