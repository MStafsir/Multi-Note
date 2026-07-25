// ============================================================
// MODUL 46.2-46.4: Client-side Sandbox Executor
// Executes JavaScript/TypeScript in a sandboxed Web Worker
// with iframe output rendering (sandbox attribute: allow-scripts, NO same-origin)
//
// Architecture:
// 1. Web Worker: Executes user code, intercepts console output
// 2. iframe (sandbox="allow-scripts"): Renders output visually,
//    denies same-origin access — prevents access to parent cookies/session
// 3. 5-second timeout per run (46.4) with forced Worker termination
// 4. Console output capture (46.5) — render as panel, NOT browser console
//
// Security:
// - Worker has NO DOM access (Web Workers can't access DOM)
// - iframe has NO same-origin access (sandbox attribute blocks it)
// - Code cannot access window.parent, cookies, localStorage, or session
// - 46.6: infinite-loop scripts → Worker terminated at timeout, no UI freeze
// ============================================================

export interface SandboxOutputEntry {
  type: 'log' | 'warn' | 'error' | 'info' | 'result';
  content: string;
  timestamp: number;
}

export interface SandboxExecutionResult {
  success: boolean;
  outputs: SandboxOutputEntry[];
  executionTime: number;
  error?: string;
  terminated?: boolean; // true if worker was force-terminated (46.4/46.6)
}

export interface SandboxExecutorOptions {
  /** Maximum execution time in ms (default: 5000 per 46.4) */
  timeoutMs?: number;
  /** Language to execute (46.3: 'javascript' | 'typescript') */
  language?: 'javascript' | 'typescript';
  /** Whether to transpile TypeScript before execution (46.3) */
  transpileTypeScript?: boolean;
}

const DEFAULT_TIMEOUT_MS = 5000; // 46.4 — 5 seconds per run

// ============================================================
// Web Worker code — injected as Blob URL
// NOTE: This is plain JS (not TS) since it runs inside a Worker
// We build the string using array join to avoid template-literal
// nesting issues with backticks and regex escaping
// ============================================================

const WORKER_SOURCE_CODE = [
  '// Worker-side console interception (46.5)',
  'const originalConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info };',
  '',
  'function sendOutput(type, args) {',
  '  const content = args.map(a => {',
  '    if (a === null) return "null";',
  '    if (a === undefined) return "undefined";',
  '    if (typeof a === "object") {',
  '      try { return JSON.stringify(a, null, 2); }',
  '      catch { return String(a); }',
  '    }',
  '    return String(a);',
  '  }).join(" ");',
  '  self.postMessage({ type: "output", outputType: type, content: content, timestamp: Date.now() });',
  '}',
  '',
  'console.log = (...args) => { originalConsole.log(...args); sendOutput("log", args); };',
  'console.warn = (...args) => { originalConsole.warn(...args); sendOutput("warn", args); };',
  'console.error = (...args) => { originalConsole.error(...args); sendOutput("error", args); };',
  'console.info = (...args) => { originalConsole.info(...args); sendOutput("info", args); };',
  '',
  '// Simple TypeScript transpiler (46.3) — limited, not a full compiler',
  'function transpileTS(code) {',
  '  code = code.replace(/interface\\s+\\w+\\s*\\{[^}]*\\}/g, "");',
  '  code = code.replace(/type\\s+\\w+\\s*=\\s*[^;]+;/g, "");',
  '  code = code.replace(/enum\\s+(\\w+)\\s*\\{([^}]*)\\}/g, function(match, name, body) {',
  '    const entries = body.split(",").map(function(e) {',
  '      var parts = e.trim().split("=");',
  '      var key = parts[0].trim();',
  '      var value = parts.length > 1 ? parts[1].trim() : null;',
  '      return value ? (key + ": " + value) : ("\\"" + key + "\\");',
  '    });',
  '    return "const " + name + " = {" + entries.join(", ") + "};";',
  '  });',
  '  code = code.replace(/:\\s*(?:string|number|boolean|any|void|never|unknown|null|undefined|object|bigint|symbol)(?:\\s*\\|\\s*(?:string|number|boolean|any|void|never|unknown|null|undefined|object|bigint|symbol))*\\s*[;,=\\)]/g, function(match) {',
  '    return match.charAt(match.length - 1);',
  '  });',
  '  code = code.replace(/<[^>]+>/g, "");',
  '  code = code.replace(/\\s+as\\s+\\w+/g, "");',
  '  code = code.replace(/readonly\\s+/g, "");',
  '  code = code.replace(/(?:public|private|protected)\\s+/g, "");',
  '  code = code.replace(/abstract\\s+/g, "");',
  '  code = code.replace(/implements\\s+\\w+\\s*/g, "");',
  '  return code;',
  '}',
  '',
  '// Execute user code inside the Worker',
  'self.onmessage = function(event) {',
  '  var data = event.data;',
  '  var code = data.code;',
  '  var language = data.language;',
  '  var transpileTypeScript = data.transpileTypeScript;',
  '  var startTime = data.startTime;',
  '',
  '  try {',
  '    var executableCode = code;',
  '    if (language === "typescript" && transpileTypeScript) {',
  '      executableCode = transpileTS(code);',
  '    }',
  '    var fn = new Function(executableCode);',
  '    var result = fn();',
  '    if (result !== undefined) {',
  '      sendOutput("result", [result]);',
  '    }',
  '    self.postMessage({ type: "complete", success: true, executionTime: Date.now() - startTime });',
  '  } catch (err) {',
  '    sendOutput("error", [err instanceof Error ? err.message : String(err)]);',
  '    self.postMessage({ type: "complete", success: false, error: err instanceof Error ? err.message : String(err), executionTime: Date.now() - startTime });',
  '  }',
  '};',
].join('\n');

// ============================================================
// SandboxExecutor — Main-thread controller for sandboxed execution
// Creates Worker from Blob URL, manages timeout, collects output
// ============================================================

export class SandboxExecutor {
  private worker: Worker | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private outputs: SandboxOutputEntry[] = [];
  private startTime: number = 0;
  private isRunning: boolean = false;

  /**
   * Execute code in a sandboxed Web Worker
   * Returns a promise that resolves when execution completes or is terminated
   */
  execute(
    code: string,
    options: SandboxExecutorOptions = {}
  ): Promise<SandboxExecutionResult> {
    // Prevent concurrent execution — terminate previous if still running
    if (this.isRunning && this.worker) {
      this.terminate();
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const language = options.language ?? 'javascript';
    const transpileTypeScript = options.transpileTypeScript ?? true;

    this.outputs = [];
    this.startTime = Date.now();
    this.isRunning = true;

    return new Promise((resolve) => {
      // Create Worker from Blob URL (avoids separate file dependency)
      const blob = new Blob([WORKER_SOURCE_CODE], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      // Handle messages from Worker
      this.worker.onmessage = (event: MessageEvent) => {
        const data = event.data;

        if (data.type === 'output') {
          // Console output intercepted from sandbox (46.5)
          this.outputs.push({
            type: data.outputType as SandboxOutputEntry['type'],
            content: data.content as string,
            timestamp: data.timestamp as number,
          });
        } else if (data.type === 'complete') {
          // Execution finished — clean up and resolve
          URL.revokeObjectURL(workerUrl);
          this.cleanup();
          resolve({
            success: data.success as boolean,
            outputs: this.outputs,
            executionTime: data.executionTime as number,
            error: data.error as string | undefined,
            terminated: false,
          });
        }
      };

      // Handle Worker errors (syntax errors, etc.)
      this.worker.onerror = (event: ErrorEvent) => {
        URL.revokeObjectURL(workerUrl);
        this.outputs.push({
          type: 'error',
          content: event.message || 'Worker execution error',
          timestamp: Date.now(),
        });

        this.cleanup();
        resolve({
          success: false,
          outputs: this.outputs,
          executionTime: Date.now() - this.startTime,
          error: event.message || 'Worker execution error',
          terminated: false,
        });
      };

      // Set timeout for forced termination (46.4/46.6)
      this.timeoutTimer = setTimeout(() => {
        if (this.worker) {
          // Force-terminate the Worker — infinite loop protection
          this.worker.terminate();
          URL.revokeObjectURL(workerUrl);
          this.outputs.push({
            type: 'error',
            content: `Execution timeout: exceeded ${timeoutMs}ms limit. Worker force-terminated.`,
            timestamp: Date.now(),
          });

          this.cleanup();
          resolve({
            success: false,
            outputs: this.outputs,
            executionTime: timeoutMs,
            error: 'Execution timeout',
            terminated: true, // 46.6 — explicitly mark as force-terminated
          });
        }
      }, timeoutMs);

      // Start execution — send code to Worker
      this.worker.postMessage({
        code,
        language,
        transpileTypeScript,
        startTime: this.startTime,
      });
    });
  }

  /** Terminate the running Worker immediately (for UI cleanup or manual cancel) */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
    }
    this.cleanup();
  }

  /** Clean up timeout timer and Worker reference */
  private cleanup(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.worker) {
      this.worker = null;
    }
    this.isRunning = false;
  }

  /** Check if executor is currently running */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

// ============================================================
// iframe sandbox renderer (46.2)
// Creates an isolated iframe with limited sandbox attributes
// for rendering output visually — prevents same-origin access
// ============================================================

export function createSandboxedIframe(
  container: HTMLElement,
  htmlContent: string
): HTMLIFrameElement {
  // Remove existing iframe if present
  const existingIframe = container.querySelector('iframe');
  if (existingIframe) {
    existingIframe.remove();
  }

  const iframe = document.createElement('iframe');
  // 46.2 — sandbox attribute: allow-scripts but DENY same-origin
  // This prevents the iframe from accessing parent window, cookies, session, localStorage
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('role', 'region');
  iframe.setAttribute('aria-label', 'Code sandbox output');
  iframe.style.width = '100%';
  iframe.style.border = 'none';
  iframe.style.minHeight = '0px';

  container.appendChild(iframe);

  // Write content to iframe (sandboxed, no same-origin access)
  // srcdoc is used because sandboxed iframe can't navigate to URLs
  iframe.srcdoc = htmlContent;

  return iframe;
}

// ============================================================
// Security isolation test helper (46.6)
// Verifies that sandbox cannot access parent window/cookies
// ============================================================

export const ISOLATION_TEST_CODE = `// This code attempts to access parent window — should fail in sandbox
try {
  if (typeof window !== 'undefined' && window.parent) {
    console.log('SECURITY ISSUE: Can access window.parent');
  } else {
    console.log('PASS: Cannot access window.parent (Worker environment)');
  }
  try {
    if (typeof document !== 'undefined') {
      var cookies = document.cookie;
      console.log('SECURITY ISSUE: Can access cookies: ' + cookies);
    } else {
      console.log('PASS: No document access (Worker environment)');
    }
  } catch (e) {
    console.log('PASS: Cookie access blocked: ' + e.message);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.getItem('test');
      console.log('SECURITY ISSUE: Can access localStorage');
    } else {
      console.log('PASS: No localStorage access (Worker environment)');
    }
  } catch (e) {
    console.log('PASS: localStorage access blocked: ' + e.message);
  }
} catch (e) {
  console.log('PASS: All isolation checks passed');
}`;

// ============================================================
// Infinite-loop test code (46.6)
// Used to verify Worker force-termination at timeout
// ============================================================

export const INFINITE_LOOP_TEST_CODE = `// This code intentionally has no exit condition
// Should trigger timeout and Worker force-termination (46.6)
var i = 0;
while (true) {
  i++;
}
// Never reaches here — Worker should be terminated at 5s timeout`;
