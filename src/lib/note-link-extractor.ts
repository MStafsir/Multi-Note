// ============================================================
// MODUL 34.2: Note Link Extractor — Parses Tiptap content_json
// Recursively walks the ProseMirror JSON tree to find all
// NoteLinkMention nodes (type === 'noteLinkMention')
// Returns array of { targetNodeId, targetNoteName, position }
// ============================================================

export interface ExtractedNoteLink {
  targetNodeId: string;
  targetNoteName: string;
  position: number; // offset in the document for context extraction
}

/**
 * Parse Tiptap ProseMirror JSON content and extract all NoteLinkMention nodes.
 * NoteLinkMention is a custom inline node with attrs: { noteId, noteName }
 * The position tracks the offset in the flat document sequence for context extraction.
 */
export function extractNoteLinks(contentJson: string): ExtractedNoteLink[] {
  try {
    const parsed = JSON.parse(contentJson);
    if (!parsed || parsed.type !== 'doc') {
      return [];
    }
    const links: ExtractedNoteLink[] = [];
    let position = 0;
    walkProseMirrorTree(parsed, links, position);
    return links;
  } catch {
    // If JSON parse fails, contentJson is invalid — return empty
    return [];
  }
}

/**
 * Recursively walk the ProseMirror JSON tree.
 * Track approximate position (character offset) for context extraction.
 */
function walkProseMirrorTree(
  node: ProseMirrorNode,
  links: ExtractedNoteLink[],
  position: number
): number {
  if (!node) return position;

  // If this is a NoteLinkMention node, extract it
  if (node.type === 'noteLinkMention') {
    const noteId = (node.attrs as Record<string, unknown>)?.noteId as string | undefined;
    const noteName = (node.attrs as Record<string, unknown>)?.noteName as string | undefined;

    if (noteId && noteName) {
      links.push({
        targetNodeId: noteId,
        targetNoteName: noteName,
        position,
      });
    }
    // NoteLinkMention is an inline atom, contributes ~1 position unit
    return position + 1;
  }

  // If this is a text node, advance position by text length
  if (node.type === 'text' && typeof node.text === 'string') {
    return position + node.text.length;
  }

  // If this node has content (children), recursively process
  if (Array.isArray(node.content)) {
    let currentPos = position;
    for (const child of node.content) {
      currentPos = walkProseMirrorTree(child as ProseMirrorNode, links, currentPos);
    }
    return currentPos;
  }

  // Other node types (paragraph, heading, etc.) — contribute no text position
  // but their children will be walked
  return position;
}

/**
 * Extract a context snippet around a NoteLinkMention position.
 * Gets ~100 chars before and ~100 chars after the link position from the
 * plain text representation of the document.
 */
export function extractContextSnippet(
  contentJson: string,
  linkPosition: number,
  beforeChars: number = 100,
  afterChars: number = 100
): string {
  const plainText = extractPlainTextFromProseMirror(contentJson);
  if (!plainText) return '';

  const start = Math.max(0, linkPosition - beforeChars);
  const end = Math.min(plainText.length, linkPosition + afterChars);

  let snippet = plainText.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < plainText.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Extract plain text from ProseMirror JSON (same pattern as search API).
 */
function extractPlainTextFromProseMirror(contentJson: string): string {
  try {
    const parsed = JSON.parse(contentJson);
    return extractTextFromNode(parsed);
  } catch {
    return contentJson;
  }
}

function extractTextFromNode(node: Record<string, unknown>): string {
  if (!node) return '';

  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }

  // NoteLinkMention — render as [[noteName]]
  if (node.type === 'noteLinkMention') {
    const noteName = (node.attrs as Record<string, unknown>)?.noteName as string | undefined;
    return noteName ? `[[${noteName}]]` : '';
  }

  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[])
      .map(child => extractTextFromNode(child))
      .join(' ');
  }

  return '';
}

// ProseMirror node type interface
interface ProseMirrorNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: Record<string, unknown>[];
}
