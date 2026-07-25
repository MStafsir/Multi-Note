// ============================================================
// MODUL 46.2-46.5: CodeSandbox Preview Component
// Interactive executable code block with:
// - Source code editor (textarea)
// - Language selector (JavaScript/TypeScript, 46.3)
// - Run button → executes in sandboxed Worker+iframe
// - Output panel below block (46.5 — intercepted console, NOT browser console)
// - Timeout indicator (46.4 — 5s limit, forced termination)
// - Toggle between source/output/live_preview modes
//
// Security (46.6):
// - Worker has NO DOM access, cannot access parent window/cookies
// - iframe sandbox="allow-scripts" denies same-origin
// - Infinite-loop → Worker terminated at timeout, no UI freeze
// ============================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { SandboxExecutor, type SandboxOutputEntry, type SandboxExecutionResult } from '@/lib/sandbox-executor';
import { Play, Square, Code2, Terminal, Columns2, AlertTriangle, Loader2, Clock, Shield, Trash2, ChevronDown, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ============================================================
// View modes for the code sandbox block
// ============================================================
type CodeSandboxViewMode = 'source' | 'output' | 'live_preview';

interface CodeSandboxPreviewProps {
  /** Source code string */
  source: string;
  /** Language: 'javascript' or 'typescript' (46.3) */
  language: 'javascript' | 'typescript';
  /** Block title */
  title: string;
  /** Callback when source is updated */
  onSourceChange: (newSource: string) => void;
  /** Callback when language is changed */
  onLanguageChange: (newLanguage: 'javascript' | 'typescript') => void;
  /** Callback when title is changed */
  onTitleChange: (newTitle: string) => void;
}

export function CodeSandboxPreview({
  source,
  language,
  title,
  onSourceChange,
  onLanguageChange,
  onTitleChange,
}: CodeSandboxPreviewProps) {
  const [viewMode, setViewMode] = useState<CodeSandboxViewMode>('source');
  const [isRunning, setIsRunning] = useState(false);
  const [outputs, setOutputs] = useState<SandboxOutputEntry[]>([]);
  const [lastResult, setLastResult] = useState<SandboxExecutionResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const executorRef = useRef<SandboxExecutor | null>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Initialize executor
  useEffect(() => {
    executorRef.current = new SandboxExecutor();
    return () => {
      // Cleanup: terminate any running Worker on unmount
      if (executorRef.current) {
        executorRef.current.terminate();
      }
    };
  }, []);

  // Scroll output to bottom when new entries arrive
  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [outputs]);

  // Handle source edit
  const handleSourceEdit = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onSourceChange(e.target.value);
    },
    [onSourceChange]
  );

  // Execute code in sandbox (46.2-46.4)
  const handleRun = useCallback(async () => {
    if (!executorRef.current || isRunning) return;

    setIsRunning(true);
    setOutputs([]);
    setLastResult(null);
    setViewMode('live_preview'); // Switch to live preview during execution

    const result = await executorRef.current.execute(source, {
      language,
      timeoutMs: 5000, // 46.4 — 5-second timeout
      transpileTypeScript: language === 'typescript', // 46.3 — transpile TS
    });

    setOutputs(result.outputs);
    setLastResult(result);
    setIsRunning(false);

    // Switch to output view if not in live_preview
    if (viewMode !== 'live_preview') {
      setViewMode('output');
    }
  }, [source, language, isRunning, viewMode]);

  // Stop execution (manual cancel)
  const handleStop = useCallback(() => {
    if (executorRef.current && isRunning) {
      executorRef.current.terminate();
      setIsRunning(false);
      setOutputs(prev => [
        ...prev,
        {
          type: 'error',
          content: 'Execution manually stopped by user.',
          timestamp: Date.now(),
        },
      ]);
    }
  }, [isRunning]);

  // Clear output panel
  const handleClearOutput = useCallback(() => {
    setOutputs([]);
    setLastResult(null);
  }, []);

  // Toggle view mode
  const handleToggleMode = useCallback((mode: CodeSandboxViewMode) => {
    setViewMode(mode);
    if (mode === 'source' && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, []);

  // Mode buttons
  const modeButtons: Array<{
    mode: CodeSandboxViewMode;
    icon: React.ReactNode;
    label: string;
  }> = [
    { mode: 'source', icon: <Code2 className="h-3.5 w-3.5" />, label: 'Source' },
    { mode: 'output', icon: <Terminal className="h-3.5 w-3.5" />, label: 'Output' },
    { mode: 'live_preview', icon: <Columns2 className="h-3.5 w-3.5" />, label: 'Live' },
  ];

  // Output entry color mapping
  const outputColors: Record<string, string> = {
    log: 'text-foreground',
    warn: 'text-orange-500',
    error: 'text-red-500',
    info: 'text-blue-500',
    result: 'text-emerald-600',
  };

  const outputIcons: Record<string, React.ReactNode> = {
    log: null,
    warn: <AlertTriangle className="h-3 w-3 shrink-0 text-orange-500" />,
    error: <AlertTriangle className="h-3 w-3 shrink-0 text-red-500" />,
    info: null,
    result: null,
  };

  return (
    <div className="code-sandbox-preview my-3 rounded-lg border border-border bg-background overflow-hidden">
      {/* Toolbar — mode switcher, language selector, run/stop buttons */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        {/* Left: Title + language */}
        <div className="flex items-center gap-2 min-w-0">
          <Edit3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="text-xs font-medium bg-transparent border-none outline-none focus:ring-1 focus:ring-ring rounded px-1 min-w-[80px] max-w-[160px]"
            aria-label="Code sandbox block title"
          />
          <Select
            value={language}
            onValueChange={(val) => onLanguageChange(val as 'javascript' | 'typescript')}
          >
            <SelectTrigger className="h-7 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="typescript">TypeScript</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Center: Mode switcher */}
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

        {/* Right: Run/Stop buttons */}
        <div className="flex items-center gap-1.5">
          {isRunning ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStop}
              className="h-7 text-xs gap-1"
              aria-label="Stop execution"
            >
              <Square className="h-3 w-3" />
              Stop
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleRun}
              className="h-7 text-xs gap-1"
              aria-label="Run code in sandbox"
            >
              <Play className="h-3 w-3" />
              Run
            </Button>
          )}

          {/* Security indicator (46.6) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Sandboxed execution — isolated from main app
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Content area based on view mode */}
      <div className="code-sandbox-content">
        {/* Source editing view */}
        {viewMode === 'source' && (
          <div className="px-4 py-3">
            <textarea
              ref={textareaRef}
              value={source}
              onChange={handleSourceEdit}
              className="w-full text-sm bg-transparent border border-input rounded-md px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none resize-y min-h-[120px] font-mono"
              placeholder={`// Write your ${language} code here...\nconsole.log("Hello, sandbox!");`}
              aria-label="Code source editor"
              rows={8}
              spellCheck={false}
              autoFocus
            />
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>{language === 'typescript' ? 'TypeScript → transpiled to JS before execution' : 'JavaScript'}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                5s timeout limit
              </span>
            </div>
          </div>
        )}

        {/* Output view (46.5) */}
        {viewMode === 'output' && (
          <div className="px-4 py-3">
            {outputs.length === 0 && !lastResult ? (
              <div className="text-sm text-muted-foreground italic text-center py-4">
                No output yet. Click Run to execute the code.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {outputs.map((entry, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 text-sm font-mono py-1 ${
                      entry.type === 'error' ? 'bg-red-50 dark:bg-red-900/10 rounded px-2' : ''
                    }`}
                    role={entry.type === 'error' ? 'alert' : undefined}
                  >
                    {outputIcons[entry.type]}
                    <span className={`break-words whitespace-pre-wrap ${outputColors[entry.type] || 'text-foreground'}`}>
                      {entry.content}
                    </span>
                  </div>
                ))}
                <div ref={outputEndRef} />
              </div>
            )}

            {/* Execution result summary */}
            {lastResult && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  {lastResult.success ? (
                    <span className="text-emerald-600">✓ Execution completed</span>
                  ) : (
                    <span className="text-red-500">
                      {lastResult.terminated ? '⏱ Execution terminated (timeout)' : '✗ Execution failed'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span>{lastResult.executionTime}ms</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearOutput}
                    className="h-6 text-xs gap-1"
                    aria-label="Clear output"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live preview view: source + output side by side */}
        {viewMode === 'live_preview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-x divide-border">
            {/* Source editor */}
            <div className="px-4 py-3">
              <div className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                <Code2 className="h-3 w-3" />
                Source
              </div>
              <textarea
                ref={textareaRef}
                value={source}
                onChange={handleSourceEdit}
                className="w-full text-sm bg-transparent border border-input rounded-md px-2 py-1.5 focus:ring-2 focus:ring-ring focus:outline-none resize-y min-h-[120px] font-mono"
                placeholder={`// Write your ${language} code here...`}
                aria-label="Code source editor with live preview"
                rows={8}
                spellCheck={false}
              />
            </div>

            {/* Output panel */}
            <div className="px-4 py-3">
              <div className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                <Terminal className="h-3 w-3" />
                Output
                {isRunning && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              <div className="space-y-1 max-h-[240px] overflow-y-auto">
                {outputs.length === 0 && !isRunning ? (
                  <div className="text-sm text-muted-foreground italic">
                    Click Run to see output
                  </div>
                ) : (
                  outputs.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 text-sm font-mono py-0.5 ${
                        entry.type === 'error' ? 'bg-red-50 dark:bg-red-900/10 rounded px-1' : ''
                      }`}
                    >
                      {outputIcons[entry.type]}
                      <span className={`break-words whitespace-pre-wrap ${outputColors[entry.type] || 'text-foreground'}`}>
                        {entry.content}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Execution result summary */}
              {lastResult && (
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border text-xs text-muted-foreground">
                  <span>
                    {lastResult.success ? (
                      <span className="text-emerald-600">✓ Completed ({lastResult.executionTime}ms)</span>
                    ) : (
                      <span className="text-red-500">
                        {lastResult.terminated ? '⏱ Terminated' : '✗ Failed'} ({lastResult.executionTime}ms)
                      </span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearOutput}
                    className="h-6 text-xs gap-1"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Tooltip import — use existing shadcn/ui Tooltip
// ============================================================
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
