// ============================================================
// MODUL 29: Accessibility Audit Utility
// Runtime accessibility checks for development mode ONLY.
// Checks for: missing aria-labels on icon buttons, missing alt
// text on images, empty headings, keyboard traps.
// NOT for production — only logs warnings in dev environment.
// ============================================================

interface A11yIssue {
  type: 'missing-aria-label' | 'missing-alt-text' | 'empty-heading' | 'keyboard-trap' | 'low-contrast';
  element: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Run accessibility audit on the current page DOM.
 * Returns a list of issues found.
 * Only intended for development mode use.
 */
export function runA11yAudit(): A11yIssue[] {
  if (process.env.NODE_ENV === 'production') {
    return [];
  }

  const issues: A11yIssue[] = [];

  // 1. Check for icon-only buttons missing aria-label
  const buttons = document.querySelectorAll('button');
  buttons.forEach((btn) => {
    const hasTextContent = btn.textContent?.trim().length > 0;
    const hasAriaLabel = btn.getAttribute('aria-label')?.trim().length > 0;
    const hasAriaLabelledBy = btn.getAttribute('aria-labelledby')?.trim().length > 0;
    const hasTitle = btn.getAttribute('title')?.trim().length > 0;

    // Icon-only buttons: no visible text, only icons/SVGs
    if (!hasTextContent && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
      // Check if button contains an SVG (icon button)
      const hasSvg = btn.querySelector('svg') !== null;
      if (hasSvg || btn.children.length === 0) {
        issues.push({
          type: 'missing-aria-label',
          element: describeElement(btn),
          message: 'Icon-only button lacks aria-label, aria-labelledby, or title attribute',
          severity: 'error',
        });
      }
    }

    // Check for generic aria-label like "button" (not descriptive)
    const ariaLabel = btn.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.toLowerCase() === 'button') {
      issues.push({
        type: 'missing-aria-label',
        element: describeElement(btn),
        message: 'Button aria-label is generic ("button") — use a descriptive label',
        severity: 'warning',
      });
    }
  });

  // 2. Check for images missing alt text
  const images = document.querySelectorAll('img');
  images.forEach((img) => {
    const alt = img.getAttribute('alt');
    if (alt === null || alt === undefined) {
      issues.push({
        type: 'missing-alt-text',
        element: describeElement(img),
        message: 'Image missing alt attribute — add alt="" for decorative images or descriptive alt for meaningful images',
        severity: 'error',
      });
    }
  });

  // 3. Check for empty headings
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headings.forEach((heading) => {
    const text = heading.textContent?.trim();
    if (!text || text.length === 0) {
      issues.push({
        type: 'empty-heading',
        element: describeElement(heading),
        message: `Empty <${heading.tagName.toLowerCase()}> heading — screen readers announce heading level without content`,
        severity: 'warning',
      });
    }
  });

  // 4. Check for potential keyboard traps
  // This checks if focusable elements exist and if there are any elements
  // with tabindex > 0 (which can disrupt natural tab order)
  const positiveTabindex = document.querySelectorAll('[tabindex][tabindex]:not([tabindex="0"]):not([tabindex="-1"])');
  positiveTabindex.forEach((el) => {
    const tabindexValue = parseInt(el.getAttribute('tabindex') || '0', 10);
    if (tabindexValue > 0) {
      issues.push({
        type: 'keyboard-trap',
        element: describeElement(el),
        message: `Positive tabindex (${tabindexValue}) disrupts natural tab order — use tabindex="0" or tabindex="-1"`,
        severity: 'warning',
      });
    }
  });

  // 5. Check for interactive elements nested inside interactive elements
  const interactiveParents = document.querySelectorAll('a, button, [role="button"], [role="link"]');
  interactiveParents.forEach((parent) => {
    const interactiveChildren = parent.querySelectorAll('a, button, [role="button"], [role="link"]');
    if (interactiveChildren.length > 0) {
      issues.push({
        type: 'keyboard-trap',
        element: describeElement(parent),
        message: 'Interactive element nested inside another interactive element — this can confuse screen readers',
        severity: 'warning',
      });
    }
  });

  // Log results
  if (issues.length > 0) {
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    console.group('🔍 Accessibility Audit Results');
    console.log(`Found ${errors.length} errors and ${warnings.length} warnings`);
    errors.forEach(issue => {
      console.error(`❌ [${issue.type}] ${issue.message} — Element: ${issue.element}`);
    });
    warnings.forEach(issue => {
      console.warn(`⚠️ [${issue.type}] ${issue.message} — Element: ${issue.element}`);
    });
    console.groupEnd();
  } else {
    console.log('✅ Accessibility audit: No issues found');
  }

  return issues;
}

/**
 * Describe an HTML element for logging purposes.
 */
function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const classes = el.className ? `.${el.className.toString().split(' ').slice(0, 3).join('.')}` : '';
  const textContent = el.textContent?.trim().slice(0, 30) || '';
  return `<${tag}${id}${classes}>${textContent ? ` "${textContent}"` : ''}`;
}

/**
 * Auto-run the accessibility audit periodically in development mode.
 * Can be called from a component's useEffect to set up periodic checks.
 */
export function setupA11yAuditInterval(intervalMs = 10000): () => void {
  if (process.env.NODE_ENV === 'production') {
    return () => {};
  }

  const timer = setInterval(() => {
    runA11yAudit();
  }, intervalMs);

  return () => clearInterval(timer);
}
