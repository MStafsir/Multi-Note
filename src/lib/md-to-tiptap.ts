// ============================================================
// Module 28: Markdown → Tiptap ProseMirror JSON Parser
// Converts imported Markdown files to Tiptap content_json for notes
// ============================================================

interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  text?: string;
  marks?: ProseMirrorMark[];
}

interface ProseMirrorMark {
  type: string;
  attrs?: Record<string, unknown>;
}

/**
 * Parse a Markdown string and convert it to Tiptap ProseMirror JSON.
 * Handles: headings, bold, italic, strikethrough, inline code,
 * links, images, bullet/ordered/task lists, code blocks, blockquotes,
 * tables, horizontal rules, paragraphs.
 */
export function markdownToTiptap(md: string): string {
  const doc = parseMarkdownToProseMirror(md);
  return JSON.stringify(doc);
}

function parseMarkdownToProseMirror(md: string): ProseMirrorNode {
  const lines = md.split('\n');
  const content: ProseMirrorNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      content.push({ type: 'horizontalRule' });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      content.push({
        type: 'heading',
        attrs: { level },
        content: parseInlineText(text),
      });
      i++;
      continue;
    }

    // Code block (fenced)
    if (line.trim().startsWith('```')) {
      const language = line.trim().replace(/^```/, '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      content.push({
        type: 'codeBlock',
        attrs: { language: language || null },
        content: [{ type: 'text', text: codeLines.join('\n') }],
      });
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i].trim() === '>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      // Parse the inner content as markdown recursively
      const innerDoc = parseMarkdownToProseMirror(quoteLines.join('\n'));
      content.push({
        type: 'blockquote',
        content: innerDoc.content || [],
      });
      continue;
    }

    // Table
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      content.push(parseTable(tableLines));
      continue;
    }

    // Task list
    if (/^(\s*)- \[[ x]\]\s/.test(line)) {
      const listItems: { checked: boolean; text: string; indent: number }[] = [];
      while (i < lines.length) {
        const taskMatch = lines[i].match(/^(\s*)- \[[ x]\]\s(.+)$/);
        if (taskMatch) {
          listItems.push({
            checked: taskMatch[2] === 'x',
            text: taskMatch[3],
            indent: taskMatch[1].length,
          });
          i++;
        } else {
          break;
        }
      }
      content.push(buildTaskList(listItems));
      continue;
    }

    // Bullet list
    if (/^(\s*)[-*+]\s/.test(line)) {
      const result = parseList(lines, i, 'bullet');
      content.push(result.node);
      i = result.nextIndex;
      continue;
    }

    // Ordered list
    if (/^(\s*)\d+\.\s/.test(line)) {
      const result = parseList(lines, i, 'ordered');
      content.push(result.node);
      i = result.nextIndex;
      continue;
    }

    // Paragraph (default)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].startsWith('> ') &&
      !lines[i].trim().startsWith('|') &&
      !/^(\s*)[-*+]\s/.test(lines[i]) &&
      !/^(\s*)\d+\.\s/.test(lines[i]) &&
      !/^(\s*)- \[[ x]\]\s/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('!')
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      content.push({
        type: 'paragraph',
        content: parseInlineText(paraLines.join('\n')),
      });
    }
  }

  return { type: 'doc', content };
}

/**
 * Parse inline text with bold, italic, strikethrough, code, links, images
 */
function parseInlineText(text: string): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = [];
  // We use a regex-based approach to find inline patterns
  let remaining = text;
  let pos = 0;

  while (remaining.length > 0) {
    // Image: ![alt](src "title") or ![alt](src)
    const imgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+?)(?:\s+"([^"]+)")?\)/);
    if (imgMatch) {
      nodes.push({
        type: 'image',
        attrs: {
          src: imgMatch[2],
          alt: imgMatch[1],
          title: imgMatch[3] || null,
        },
      });
      remaining = remaining.slice(imgMatch[0].length);
      pos += imgMatch[0].length;
      continue;
    }

    // Link: [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      nodes.push({
        type: 'text',
        text: linkMatch[1],
        marks: [{ type: 'link', attrs: { href: linkMatch[2], target: '_blank' } }],
      });
      remaining = remaining.slice(linkMatch[0].length);
      pos += linkMatch[0].length;
      continue;
    }

    // Inline code: `text`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      nodes.push({
        type: 'text',
        text: codeMatch[1],
        marks: [{ type: 'code' }],
      });
      remaining = remaining.slice(codeMatch[0].length);
      pos += codeMatch[0].length;
      continue;
    }

    // Bold+Italic: ***text*** or ___text___
    const boldItalicMatch = remaining.match(/^(\*\*\*|___)(.+?)(\*\*\*|___)/);
    if (boldItalicMatch) {
      nodes.push({
        type: 'text',
        text: boldItalicMatch[2],
        marks: [{ type: 'bold' }, { type: 'italic' }],
      });
      remaining = remaining.slice(boldItalicMatch[0].length);
      pos += boldItalicMatch[0].length;
      continue;
    }

    // Bold: **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)(\*\*|__)/);
    if (boldMatch) {
      nodes.push({
        type: 'text',
        text: boldMatch[2],
        marks: [{ type: 'bold' }],
      });
      remaining = remaining.slice(boldMatch[0].length);
      pos += boldMatch[0].length;
      continue;
    }

    // Strikethrough: ~~text~~
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      nodes.push({
        type: 'text',
        text: strikeMatch[1],
        marks: [{ type: 'strike' }],
      });
      remaining = remaining.slice(strikeMatch[0].length);
      pos += strikeMatch[0].length;
      continue;
    }

    // Italic: *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)(.+?)(\*|_)/);
    if (italicMatch) {
      nodes.push({
        type: 'text',
        text: italicMatch[2],
        marks: [{ type: 'italic' }],
      });
      remaining = remaining.slice(italicMatch[0].length);
      pos += italicMatch[0].length;
      continue;
    }

    // Plain text — consume until we hit a special pattern or end
    // Find the next special character
    const nextSpecial = remaining.search(/[*_~`\[!]/);
    if (nextSpecial === -1) {
      // No more special chars — rest is plain text
      if (remaining.length > 0) {
        nodes.push({ type: 'text', text: remaining });
      }
      break;
    }

    if (nextSpecial === 0) {
      // We're at a special char but didn't match any pattern above
      // This could be a lone * or _ that's not actually formatting
      // Just take it as plain text
      nodes.push({ type: 'text', text: remaining[0] });
      remaining = remaining.slice(1);
      pos += 1;
      continue;
    }

    // Plain text before the next special char
    nodes.push({ type: 'text', text: remaining.slice(0, nextSpecial) });
    remaining = remaining.slice(nextSpecial);
    pos += nextSpecial;
  }

  // If no nodes were generated but text was provided, create a single text node
  if (nodes.length === 0 && text.trim().length > 0) {
    nodes.push({ type: 'text', text });
  }

  return nodes;
}

interface ListParseResult {
  node: ProseMirrorNode;
  nextIndex: number;
}

function parseList(lines: string[], startIndex: number, listType: 'bullet' | 'ordered'): ListParseResult {
  const items: ProseMirrorNode[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    // Only process items at indent level 0 for the outer list
    if (indent > 2) break; // Too deeply indented — belongs to a nested list

    if (listType === 'bullet') {
      const bulletMatch = line.match(/^(\s*)[-*+]\s(.+)$/);
      if (!bulletMatch || indent > 0) break;
      const itemText = bulletMatch[2];

      // Check for nested lists in subsequent lines
      const subContent: ProseMirrorNode[] = [];
      const paraNode: ProseMirrorNode = {
        type: 'paragraph',
        content: parseInlineText(itemText),
      };
      subContent.push(paraNode);

      // Check if next lines are sub-items
      i++;
      while (i < lines.length) {
        const subIndentMatch = lines[i].match(/^(\s*)[-*+]\s(.+)$/);
        if (subIndentMatch && subIndentMatch[1].length > 0) {
          // Nested bullet item — parse recursively
          const nestedResult = parseList(lines, i, 'bullet');
          subContent.push(nestedResult.node);
          i = nestedResult.nextIndex;
        } else if (lines[i].match(/^(\s*)\d+\.\s(.+)$/) && lines[i].match(/^(\s*)/)?.[1]?.length > 0) {
          // Nested ordered list
          const nestedResult = parseList(lines, i, 'ordered');
          subContent.push(nestedResult.node);
          i = nestedResult.nextIndex;
        } else {
          break;
        }
      }

      items.push({ type: 'listItem', content: subContent });
    } else {
      const orderedMatch = line.match(/^(\s*)\d+\.\s(.+)$/);
      if (!orderedMatch || indent > 0) break;
      const itemText = orderedMatch[2];

      const subContent: ProseMirrorNode[] = [];
      const paraNode: ProseMirrorNode = {
        type: 'paragraph',
        content: parseInlineText(itemText),
      };
      subContent.push(paraNode);

      // Check for nested items
      i++;
      while (i < lines.length) {
        const subBulletMatch = lines[i].match(/^(\s*)[-*+]\s(.+)$/);
        if (subBulletMatch && subBulletMatch[1].length > 0) {
          const nestedResult = parseList(lines, i, 'bullet');
          subContent.push(nestedResult.node);
          i = nestedResult.nextIndex;
        } else if (lines[i].match(/^(\s*)\d+\.\s(.+)$/) && lines[i].match(/^(\s*)/)?.[1]?.length > 0) {
          const nestedResult = parseList(lines, i, 'ordered');
          subContent.push(nestedResult.node);
          i = nestedResult.nextIndex;
        } else {
          break;
        }
      }

      items.push({ type: 'listItem', content: subContent });
    }
  }

  const nodeType = listType === 'bullet' ? 'bulletList' : 'orderedList';
  return {
    node: { type: nodeType, content: items },
    nextIndex: i,
  };
}

function buildTaskList(items: { checked: boolean; text: string; indent: number }[]): ProseMirrorNode {
  const taskItems: ProseMirrorNode[] = [];

  for (const item of items) {
    taskItems.push({
      type: 'taskItem',
      attrs: { checked: item.checked },
      content: [
        {
          type: 'paragraph',
          content: parseInlineText(item.text),
        },
      ],
    });
  }

  return { type: 'taskList', content: taskItems };
}

function parseTable(tableLines: string[]): ProseMirrorNode {
  const rows: ProseMirrorNode[] = [];

  for (let lineIdx = 0; lineIdx < tableLines.length; lineIdx++) {
    const line = tableLines[lineIdx].trim();

    // Skip separator line (| --- | --- |)
    if (/^\|[\s-:|]+\|$/.test(line)) continue;

    // Parse cells
    const cells = line.split('|').filter(c => c.trim() !== '').map(c => c.trim());

    const cellNodes: ProseMirrorNode[] = cells.map((cellText, cellIdx) => {
      // First row is header
      const cellType = lineIdx === 0 ? 'tableHeader' : 'tableCell';
      return {
        type: cellType,
        content: [
          {
            type: 'paragraph',
            content: parseInlineText(cellText),
          },
        ],
        attrs: { colspan: 1, rowspan: 1, colwidth: null },
      };
    });

    rows.push({ type: 'tableRow', content: cellNodes });
  }

  return { type: 'table', content: rows };
}
