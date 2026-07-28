// ============================================================
// MODUL 7: MIME Type to Icon Mapping Utility
// Maps MIME types to preview types, Lucide icon names, and labels
// MODUL 50-51 Phase 1: PreviewTier, refined PreviewType (docx/xlsx/pptx)
// ============================================================

export type PreviewTier = 'tier1_native' | 'tier2_client' | 'tier3_server';

export type PreviewType =
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'text'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'download'
  | 'none';

// Icon name mapping (Lucide component names as strings for dynamic rendering)
export type IconName =
  | 'File'
  | 'Image'
  | 'Film'
  | 'FileText'
  | 'Music'
  | 'Archive'
  | 'Code'
  | 'Presentation'
  | 'Spreadsheet'
  | 'FileQuestion';

// MIME type category mappings (with tier field)
const MIME_CATEGORIES: Record<string, { previewType: PreviewType; icon: IconName; label: string; tier: PreviewTier }> = {
  // Images — tier1_native (browser can render natively)
  'image/jpeg': { previewType: 'image', icon: 'Image', label: 'JPEG Image', tier: 'tier1_native' },
  'image/png': { previewType: 'image', icon: 'Image', label: 'PNG Image', tier: 'tier1_native' },
  'image/gif': { previewType: 'image', icon: 'Image', label: 'GIF Image', tier: 'tier1_native' },
  'image/webp': { previewType: 'image', icon: 'Image', label: 'WebP Image', tier: 'tier1_native' },
  'image/svg+xml': { previewType: 'image', icon: 'Image', label: 'SVG Image', tier: 'tier1_native' },
  'image/bmp': { previewType: 'image', icon: 'Image', label: 'BMP Image', tier: 'tier1_native' },
  'image/tiff': { previewType: 'image', icon: 'Image', label: 'TIFF Image', tier: 'tier1_native' },
  'image/avif': { previewType: 'image', icon: 'Image', label: 'AVIF Image', tier: 'tier1_native' },
  'image/ico': { previewType: 'image', icon: 'Image', label: 'ICO Image', tier: 'tier1_native' },

  // PDFs — tier1_native (browser PDF viewer)
  'application/pdf': { previewType: 'pdf', icon: 'FileText', label: 'PDF Document', tier: 'tier1_native' },

  // Videos — tier1_native (browser <video> element)
  'video/mp4': { previewType: 'video', icon: 'Film', label: 'MP4 Video', tier: 'tier1_native' },
  'video/webm': { previewType: 'video', icon: 'Film', label: 'WebM Video', tier: 'tier1_native' },
  'video/ogg': { previewType: 'video', icon: 'Film', label: 'OGG Video', tier: 'tier1_native' },
  'video/quicktime': { previewType: 'video', icon: 'Film', label: 'QuickTime Video', tier: 'tier1_native' },
  'video/x-msvideo': { previewType: 'video', icon: 'Film', label: 'AVI Video', tier: 'tier1_native' },
  'video/x-matroska': { previewType: 'video', icon: 'Film', label: 'MKV Video', tier: 'tier1_native' },

  // Audio — tier1_native (browser <audio> element)
  'audio/mpeg': { previewType: 'audio', icon: 'Music', label: 'MP3 Audio', tier: 'tier1_native' },
  'audio/wav': { previewType: 'audio', icon: 'Music', label: 'WAV Audio', tier: 'tier1_native' },
  'audio/ogg': { previewType: 'audio', icon: 'Music', label: 'OGG Audio', tier: 'tier1_native' },
  'audio/flac': { previewType: 'audio', icon: 'Music', label: 'FLAC Audio', tier: 'tier1_native' },
  'audio/aac': { previewType: 'audio', icon: 'Music', label: 'AAC Audio', tier: 'tier1_native' },
  'audio/webm': { previewType: 'audio', icon: 'Music', label: 'WebM Audio', tier: 'tier1_native' },
  'audio/x-m4a': { previewType: 'audio', icon: 'Music', label: 'M4A Audio', tier: 'tier1_native' },

  // Documents / Text — tier1_native (browser can render plain text)
  'text/plain': { previewType: 'text', icon: 'FileText', label: 'Text File', tier: 'tier1_native' },
  'text/csv': { previewType: 'text', icon: 'Spreadsheet', label: 'CSV File', tier: 'tier1_native' },
  'text/html': { previewType: 'text', icon: 'Code', label: 'HTML File', tier: 'tier1_native' },
  'text/css': { previewType: 'text', icon: 'Code', label: 'CSS File', tier: 'tier1_native' },
  'text/xml': { previewType: 'text', icon: 'Code', label: 'XML File', tier: 'tier1_native' },
  'text/markdown': { previewType: 'text', icon: 'FileText', label: 'Markdown File', tier: 'tier1_native' },
  'application/json': { previewType: 'text', icon: 'Code', label: 'JSON File', tier: 'tier1_native' },
  'application/xml': { previewType: 'text', icon: 'Code', label: 'XML File', tier: 'tier1_native' },
  'application/javascript': { previewType: 'text', icon: 'Code', label: 'JavaScript File', tier: 'tier1_native' },
  'application/typescript': { previewType: 'text', icon: 'Code', label: 'TypeScript File', tier: 'tier1_native' },

  // Office documents — docx/xlsx/pptx with tier2_client or tier3_server
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    previewType: 'docx', icon: 'FileText', label: 'Word Document', tier: 'tier2_client',
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    previewType: 'xlsx', icon: 'Spreadsheet', label: 'Excel Spreadsheet', tier: 'tier2_client',
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    previewType: 'pptx', icon: 'Presentation', label: 'PowerPoint Presentation', tier: 'tier3_server',
  },
  'application/msword': { previewType: 'docx', icon: 'FileText', label: 'Word Document', tier: 'tier2_client' },
  'application/vnd.ms-excel': { previewType: 'xlsx', icon: 'Spreadsheet', label: 'Excel Spreadsheet', tier: 'tier2_client' },
  'application/vnd.ms-powerpoint': { previewType: 'pptx', icon: 'Presentation', label: 'PowerPoint Presentation', tier: 'tier3_server' },

  // Archives — tier3_server (no inline preview, server-side download only)
  'application/zip': { previewType: 'none', icon: 'Archive', label: 'ZIP Archive', tier: 'tier3_server' },
  'application/x-tar': { previewType: 'none', icon: 'Archive', label: 'TAR Archive', tier: 'tier3_server' },
  'application/gzip': { previewType: 'none', icon: 'Archive', label: 'GZIP Archive', tier: 'tier3_server' },
  'application/x-rar-compressed': { previewType: 'none', icon: 'Archive', label: 'RAR Archive', tier: 'tier3_server' },
  'application/x-7z-compressed': { previewType: 'none', icon: 'Archive', label: '7-Zip Archive', tier: 'tier3_server' },

  // Code / Dev files — tier1_native (viewable as plain text)
  'application/x-python': { previewType: 'text', icon: 'Code', label: 'Python File', tier: 'tier1_native' },
  'application/x-java': { previewType: 'text', icon: 'Code', label: 'Java File', tier: 'tier1_native' },
  'application/x-c': { previewType: 'text', icon: 'Code', label: 'C Source File', tier: 'tier1_native' },
  'application/x-cpp': { previewType: 'text', icon: 'Code', label: 'C++ Source File', tier: 'tier1_native' },
  'application/x-shellscript': { previewType: 'text', icon: 'Code', label: 'Shell Script', tier: 'tier1_native' },
  'text/x-python': { previewType: 'text', icon: 'Code', label: 'Python File', tier: 'tier1_native' },
  'text/x-java': { previewType: 'text', icon: 'Code', label: 'Java Source File', tier: 'tier1_native' },
  'text/x-c': { previewType: 'text', icon: 'Code', label: 'C Source File', tier: 'tier1_native' },
  'text/x-c++': { previewType: 'text', icon: 'Code', label: 'C++ Source File', tier: 'tier1_native' },
  'text/x-sh': { previewType: 'text', icon: 'Code', label: 'Shell Script', tier: 'tier1_native' },
  'text/x-ruby': { previewType: 'text', icon: 'Code', label: 'Ruby File', tier: 'tier1_native' },
  'text/x-go': { previewType: 'text', icon: 'Code', label: 'Go Source File', tier: 'tier1_native' },
  'text/x-rust': { previewType: 'text', icon: 'Code', label: 'Rust Source File', tier: 'tier1_native' },
  'text/x-swift': { previewType: 'text', icon: 'Code', label: 'Swift File', tier: 'tier1_native' },
  'text/x-kotlin': { previewType: 'text', icon: 'Code', label: 'Kotlin File', tier: 'tier1_native' },
  'text/x-sql': { previewType: 'text', icon: 'Code', label: 'SQL Script', tier: 'tier1_native' },
  'text/x-yaml': { previewType: 'text', icon: 'Code', label: 'YAML File', tier: 'tier1_native' },
  'text/x-toml': { previewType: 'text', icon: 'Code', label: 'TOML File', tier: 'tier1_native' },
  'text/x-dockerfile': { previewType: 'text', icon: 'Code', label: 'Dockerfile', tier: 'tier1_native' },
  'text/x-makefile': { previewType: 'text', icon: 'Code', label: 'Makefile', tier: 'tier1_native' },
  'application/x-yaml': { previewType: 'text', icon: 'Code', label: 'YAML File', tier: 'tier1_native' },
  'application/x-httpd-php': { previewType: 'text', icon: 'Code', label: 'PHP File', tier: 'tier1_native' },
  'application/x-perl': { previewType: 'text', icon: 'Code', label: 'Perl Script', tier: 'tier1_native' },
};

/**
 * Determine the preview type for a given MIME type.
 * Falls back to prefix-based matching, then 'none'.
 * MODUL 50-51: Office MIME types now resolve to docx/xlsx/pptx specifically.
 */
export function getMimePreviewType(mimeType: string): PreviewType {
  // Exact match
  const exact = MIME_CATEGORIES[mimeType];
  if (exact) return exact.previewType;

  // Prefix-based fallback
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/')) return 'text';
  // Office document types — detect docx/xlsx/pptx specifically instead of blanket 'office'
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'docx';
  if (mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel')) return 'xlsx';
  if (mimeType.includes('presentationml') || mimeType.includes('ms-powerpoint')) return 'pptx';
  // Generic officedocument prefix that doesn't match known subtypes → download
  if (mimeType.includes('officedocument')) return 'download';

  return 'none';
}

/**
 * Determine the preview tier for a given MIME type.
 * Falls back to prefix-based matching, then 'tier3_server'.
 */
export function getPreviewTier(mimeType: string): PreviewTier {
  // Exact match
  const exact = MIME_CATEGORIES[mimeType];
  if (exact) return exact.tier;

  // Prefix-based fallback (matches same logic as getMimePreviewType)
  if (mimeType.startsWith('image/')) return 'tier1_native';
  if (mimeType.startsWith('video/')) return 'tier1_native';
  if (mimeType.startsWith('audio/')) return 'tier1_native';
  if (mimeType === 'application/pdf') return 'tier1_native';
  if (mimeType.startsWith('text/')) return 'tier1_native';
  // Office documents
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'tier2_client';
  if (mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel')) return 'tier2_client';
  if (mimeType.includes('presentationml') || mimeType.includes('ms-powerpoint')) return 'tier3_server';
  // Everything else needs server-side handling
  return 'tier3_server';
}

/**
 * Check if a PreviewType is an Office preview type (docx, xlsx, or pptx).
 */
export function isOfficePreviewType(type: PreviewType): boolean {
  return type === 'docx' || type === 'xlsx' || type === 'pptx';
}

/**
 * Get the Lucide icon component name for a given MIME type.
 * Returns string name of the icon for dynamic rendering.
 */
export function getMimeIcon(mimeType: string): IconName {
  const exact = MIME_CATEGORIES[mimeType];
  if (exact) return exact.icon;

  // Prefix-based fallback
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.startsWith('video/')) return 'Film';
  if (mimeType.startsWith('audio/')) return 'Music';
  if (mimeType === 'application/pdf') return 'FileText';
  if (mimeType.startsWith('text/')) return 'FileText';

  return 'FileQuestion';
}

/**
 * Get a human-readable label for a given MIME type.
 */
export function getMimeLabel(mimeType: string): string {
  const exact = MIME_CATEGORIES[mimeType];
  if (exact) return exact.label;

  // Prefix-based fallback
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.startsWith('video/')) return 'Video';
  if (mimeType.startsWith('audio/')) return 'Audio';
  if (mimeType === 'application/pdf') return 'PDF Document';
  if (mimeType.startsWith('text/')) return 'Text File';

  // Try to extract a readable name from the MIME type
  const parts = mimeType.split('/');
  if (parts.length === 2) {
    const subtype = parts[1];
    // Remove common prefixes like "vnd." and "x-"
    const cleaned = subtype.replace(/^vnd\.|^x-/, '');
    return `${cleaned} File`;
  }

  return 'Unknown File';
}

/**
 * Map icon names to actual Lucide React icon components.
 * Used in the FilePreview component to render the appropriate icon.
 */
export const ICON_MAP: Record<IconName, string> = {
  File: 'File',
  Image: 'Image',
  Film: 'Film',
  FileText: 'FileText',
  Music: 'Music',
  Archive: 'Archive',
  Code: 'Code',
  Presentation: 'Presentation',
  Spreadsheet: 'Spreadsheet',
  FileQuestion: 'FileQuestion',
};

/**
 * Format file size into human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
