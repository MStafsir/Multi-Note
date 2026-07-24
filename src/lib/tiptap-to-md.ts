// ============================================================
// Module 28: Tiptap ProseMirror JSON → Markdown Serializer
// Converts Tiptap editor content_json to clean Markdown for export
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
 * Serialize a Tiptap ProseMirror JSON document to Markdown string.
 * Handles: headings (h1-h6), paragraphs, bold, italic, strikethrough,
 * lists (bullet, ordered, task), code blocks, blockquotes, tables,
 * images (links), horizontal rules.
 */
export function tiptapToMarkdown(json: string | ProseMirrorNode): string {
  let doc: ProseMirrorNode;
  if (typeof json === 'string') {
    try {
      doc = JSON.parse(json);
    } catch {
      // If it's not valid JSON, return as-is (could be plain text)
      return json;
    }
  } else {
    doc = json;
  }

  if (!doc || !doc.content) {
    return '';
  }

  const lines: string[] = [];
  for (const node of doc.content) {
    lines.push(serializeNode(node, 0));
  }

  // Clean up: remove excessive blank lines
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function serializeNode(node: ProseMirrorNode, indent: number): string {
  switch (node.type) {
    case 'heading':
      return serializeHeading(node);
    case 'paragraph':
      return serializeParagraph(node, indent);
    case 'bulletList':
      return serializeBulletList(node, indent);
    case 'orderedList':
      return serializeOrderedList(node, indent);
    case 'taskList':
      return serializeTaskList(node, indent);
    case 'listItem':
      return serializeListItem(node, indent, 'bullet');
    case 'codeBlock':
      return serializeCodeBlock(node);
    case 'blockquote':
      return serializeBlockquote(node);
    case 'table':
      return serializeTable(node);
    case 'image':
      return serializeImage(node);
    case 'horizontalRule':
      return '\n---\n';
    case 'hardBreak':
      return '\n';
    case 'text':
      return serializeTextWithMarks(node);
    default:
      // For unknown node types, try to serialize content recursively
      if (node.content) {
        return node.content.map(child => serializeNode(child, indent)).join('');
      }
      return '';
  }
}

function serializeHeading(node: ProseMirrorNode): string {
  const level = (node.attrs?.level as number) || 1;
  const prefix = '#'.repeat(Math.min(level, 6));
  const text = node.content ? node.content.map(serializeInlineNode).join('') : '';
  return `${prefix} ${text}`;
}

function serializeParagraph(node: ProseMirrorNode, indent: number): string {
  const text = node.content ? node.content.map(serializeInlineNode).join('') : '';
  if (!text.trim()) return '';
  // Apply list indent if inside a list context
  if (indent > 0) {
    return text;
  }
  return text;
}

function serializeInlineNode(node: ProseMirrorNode): string {
  if (node.type === 'text') {
    return serializeTextWithMarks(node);
  }
  if (node.type === 'hardBreak') {
    return '\n';
  }
  if (node.type === 'image') {
    return serializeImage(node);
  }
  // Fallback for other inline nodes
  if (node.text) return node.text;
  if (node.content) return node.content.map(serializeInlineNode).join('');
  return '';
}

function serializeTextWithMarks(node: ProseMirrorNode): string {
  if (!node.text) return '';

  const text = node.text;
  const marks = node.marks || [];

  let result = text;

  // Process marks — order matters for proper nesting
  const markTypes = marks.map(m => m.type);

  // Strikethrough (outermost)
  if (markTypes.includes('strike')) {
    result = `~~${result}~~`;
  }

  // Bold
  if (markTypes.includes('bold')) {
    result = `**${result}**`;
  }

  //Italic
  if (markTypes.includes('italic')) {
    result = `*${result}*`;
  }

  // Code (inline)
  if (markTypes.includes('code')) {
    result = `\`${result}\``;
  }

  // Link
  const linkMark = marks.find(m => m.type === 'link');
  if (linkMark && linkMark.attrs) {
    const href = linkMark.attrs.href as string || '';
    result = `[${result}](${href})`;
  }

  // Underline — Markdown doesn't natively support underline, use HTML
  if (markTypes.includes('underline')) {
    result = `<u>${result}</u>`;
  }

  // Highlight/subscript/superscript — use HTML fallbacks
  if (markTypes.includes('highlight')) {
    const color = marks.find(m => m.type === 'highlight')?.attrs?.color as string;
    if (color) {
      result = `<mark style="background-color:${color}">${result}</mark>`;
    } else {
      result = `<mark>${result}</mark>`;
    }
  }

  if (markTypes.includes('subscript')) {
    result = `<sub>${result}</sub>`;
  }

  if (markTypes.includes('superscript')) {
    result = `<sup>${result}</sup>`;
  }

  return result;
}

function serializeBulletList(node: ProseMirrorNode, indent: number): string {
  const items: string[] = [];
  for (const item of node.content || []) {
    items.push(serializeListItem(item, indent, 'bullet'));
  }
  return items.join('\n');
}

function serializeOrderedList(node: ProseMirrorNode, indent: number): string {
  const start = (node.attrs?.start as number) || 1;
  const items: string[] = [];
  let counter = start;
  for (const item of node.content || []) {
    items.push(serializeListItem(item, indent, 'ordered', counter));
    counter++;
  }
  return items.join('\n');
}

function serializeTaskList(node: ProseMirrorNode, indent: number): string {
  const items: string[] = [];
  for (const item of node.content || []) {
    items.push(serializeTaskItem(item, indent));
  }
  return items.join('\n');
}

function serializeListItem(
  node: ProseMirrorNode,
  indent: number,
  listType: 'bullet' | 'ordered',
  counter?: number
): string {
  const prefix = indent > 0 ? '  '.repeat(indent) : '';
  const bullet = listType === 'ordered' ? `${counter || 1}. ` : '- ';

  // listItem contains paragraph(s) and possibly nested lists
  const parts: string[] = [];
  for (const child of node.content || []) {
    if (child.type === 'paragraph') {
      const text = child.content ? child.content.map(serializeInlineNode).join('') : '';
      parts.push(text);
    } else if (child.type === 'bulletList') {
      parts.push(serializeBulletList(child, indent + 1));
    } else if (child.type === 'orderedList') {
      parts.push(serializeOrderedList(child, indent + 1));
    } else if (child.type === 'taskList') {
      parts.push(serializeTaskList(child, indent + 1));
    } else {
      parts.push(serializeNode(child, indent + 1));
    }
  }

  const content = parts.join('\n');
  // First line gets the bullet/number prefix; continuation lines are indented
  const lines = content.split('\n');
  if (lines.length === 1) {
    return `${prefix}${bullet}${lines[0]}`;
  }
  return `${prefix}${bullet}${lines[0]}\n${lines.slice(1).map(l => `${prefix}  ${l}`).join('\n')}`;
}

function serializeTaskItem(node: ProseMirrorNode, indent: number): string {
  const prefix = indent > 0 ? '  '.repeat(indent) : '';
  // taskItem has attrs.checked
  const checked = node.attrs?.checked as boolean || false;
  const checkbox = checked ? '[x]' : '[ ]';

  // taskItem contains paragraph(s)
  const parts: string[] = [];
  for (const child of node.content || []) {
    if (child.type === 'paragraph') {
      const text = child.content ? child.content.map(serializeInlineNode).join('') : '';
      parts.push(text);
    } else {
      parts.push(serializeNode(child, indent + 1));
    }
  }

  const content = parts.join(' ');
  return `${prefix}- ${checkbox} ${content}`;
}

function serializeCodeBlock(node: ProseMirrorNode): string {
  const language = (node.attrs?.language as string) || '';
  const text = node.content ? node.content.map(n => n.text || '').join('') : '';
  const fence = '```';
  if (language) {
    return `${fence}${language}\n${text}\n${fence}`;
  }
  return `${fence}\n${text}\n${fence}`;
}

function serializeBlockquote(node: ProseMirrorNode): string {
  const lines: string[] = [];
  for (const child of node.content || []) {
    const serialized = serializeNode(child, 0);
    // Prefix each line with "> "
    for (const line of serialized.split('\n')) {
      lines.push(`> ${line}`);
    }
  }
  return lines.join('\n');
}

function serializeTable(node: ProseMirrorNode): string {
  // table → tableRow → tableCell/tableHeader
  const rows: string[][] = [];
  let isHeaderRow = true;

  for (const row of node.content || []) {
    if (row.type !== 'tableRow') continue;
    const cells: string[] = [];
    for (const cell of row.content || []) {
      const cellContent = cell.content
        ? cell.content.map(serializeInlineNode).join('')
        : '';
      cells.push(cellContent.trim());
      // Check if this row has tableHeader cells
      if (cell.type === 'tableHeader') {
        isHeaderRow = true;
      }
    }
    rows.push(cells);
  }

  if (rows.length === 0) return '';

  const mdLines: string[] = [];

  // Header row
  if (rows.length > 0) {
    mdLines.push('| ' + rows[0].join(' | ') + ' |');
    // Separator
    mdLines.push('| ' + rows[0].map(() => '---').join(' | ') + ' |');
  }

  // Body rows
  for (let i = 1; i < rows.length; i++) {
    mdLines.push('| ' + rows[i].join(' | ') + ' |');
  }

  return mdLines.join('\n');
}

function serializeImage(node: ProseMirrorNode): string {
  const src = (node.attrs?.src as string) || '';
  const alt = (node.attrs?.alt as string) || '';
  const title = (node.attrs?.title as string) || '';
  if (title) {
    return `![${alt}](${src} "${title}")`;
  }
  return `![${alt}](${src})`;
}
