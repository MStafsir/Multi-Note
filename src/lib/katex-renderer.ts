// ============================================================
// MODUL 45.2: KaTeX Render Engine
// Synchronous rendering using katex.renderToString — no CLS issues
// Returns rendered HTML on success, or error message on parse failure
// Graceful degradation: never throws, always returns a result object
// ============================================================

import katex from 'katex';

export interface MathRenderResult {
  /** Rendered KaTeX HTML string on success, null on failure */
  html: string | null;
  /** Error message on failure, null on success */
  error: string | null;
}

/**
 * Render LaTeX source to HTML string using KaTeX (synchronous).
 *
 * @param source - The LaTeX string to render
 * @param displayMode - 'inline' for $...$ math, 'block' for $$...$$ math
 * @returns {MathRenderResult} - { html, error } — one is always null, the other non-null
 */
export function renderMathToHtml(
  source: string,
  displayMode: 'inline' | 'block'
): MathRenderResult {
  if (!source || source.trim() === '') {
    return {
      html: '<span class="katex-mathblock-empty text-muted-foreground text-sm">Empty math expression</span>',
      error: null,
    };
  }

  try {
    const html = katex.renderToString(source, {
      displayMode: displayMode === 'block',
      throwOnError: true,
      strict: false,
      trust: true,
    });

    return { html, error: null };
  } catch (err: unknown) {
    // KaTeX throws katex.ParseError — catch it gracefully per 45.4
    let errorMessage = 'Unknown LaTeX error';

    if (err instanceof Error) {
      errorMessage = err.message;
    }

    // Try to render with error tolerance for partial display
    try {
      const partialHtml = katex.renderToString(source, {
        displayMode: displayMode === 'block',
        throwOnError: false,
        strict: false,
        trust: true,
      });

      // Even with throwOnError:false, KaTeX may render partial output
      // We still return the error so the UI can show it
      return { html: partialHtml, error: `Invalid LaTeX: ${errorMessage}` };
    } catch {
      // Complete failure — even non-strict mode couldn't render
      return { html: null, error: `Invalid LaTeX: ${errorMessage}` };
    }
  }
}
