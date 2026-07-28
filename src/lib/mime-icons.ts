// ============================================================
// MODUL 7: MIME Type to Icon Mapping Utility
// Maps MIME types to preview types, Lucide icon names, and labels
// ============================================================

export type PreviewType = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'office' | 'download' | 'none';

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

// MIME type category mappings
const MIME_CATEGORIES: Record<string, { previewType: PreviewType; icon: IconName; label: string }> = {
  // Images
  'image/jpeg': { previewType: 'image', icon: 'Image', label: 'JPEG Image' },
  'image/png': { previewType: 'image', icon: 'Image', label: 'PNG Image' },
  'image/gif': { previewType: 'image', icon: 'Image', label: 'GIF Image' },
  'image/webp': { previewType: 'image', icon: 'Image', label: 'WebP Image' },
  'image/svg+xml': { previewType: 'image', icon: 'Image', label: 'SVG Image' },
  'image/bmp': { previewType: 'image', icon: 'Image', label: 'BMP Image' },
  'image/tiff': { previewType: 'image', icon: 'Image', label: 'TIFF Image' },
  'image/avif': { previewType: 'image', icon: 'Image', label: 'AVIF Image' },
  'image/ico': { previewType: 'image', icon: 'Image', label: 'ICO Image' },

  // PDFs
  'application/pdf': { previewType: 'pdf', icon: 'FileText', label: 'PDF Document' },

  // Videos
  'video/mp4': { previewType: 'video', icon: 'Film', label: 'MP4 Video' },
  'video/webm': { previewType: 'video', icon: 'Film', label: 'WebM Video' },
  'video/ogg': { previewType: 'video', icon: 'Film', label: 'OGG Video' },
  'video/quicktime': { previewType: 'video', icon: 'Film', label: 'QuickTime Video' },
  'video/x-msvideo': { previewType: 'video', icon: 'Film', label: 'AVI Video' },
  'video/x-matroska': { previewType: 'video', icon: 'Film', label: 'MKV Video' },

  // Audio
  'audio/mpeg': { previewType: 'audio', icon: 'Music', label: 'MP3 Audio' },
  'audio/wav': { previewType: 'audio', icon: 'Music', label: 'WAV Audio' },
  'audio/ogg': { previewType: 'audio', icon: 'Music', label: 'OGG Audio' },
  'audio/flac': { previewType: 'audio', icon: 'Music', label: 'FLAC Audio' },
  'audio/aac': { previewType: 'audio', icon: 'Music', label: 'AAC Audio' },
  'audio/webm': { previewType: 'audio', icon: 'Music', label: 'WebM Audio' },
  'audio/x-m4a': { previewType: 'audio', icon: 'Music', label: 'M4A Audio' },

  // Documents / Text — previewType: 'text' for inline rendering
  'text/plain': { previewType: 'text', icon: 'FileText', label: 'Text File' },
  'text/csv': { previewType: 'text', icon: 'Spreadsheet', label: 'CSV File' },
  'text/html': { previewType: 'text', icon: 'Code', label: 'HTML File' },
  'text/css': { previewType: 'text', icon: 'Code', label: 'CSS File' },
  'text/xml': { previewType: 'text', icon: 'Code', label: 'XML File' },
  'text/markdown': { previewType: 'text', icon: 'FileText', label: 'Markdown File' },
  'application/json': { previewType: 'text', icon: 'Code', label: 'JSON File' },
  'application/xml': { previewType: 'text', icon: 'Code', label: 'XML File' },
  'application/javascript': { previewType: 'text', icon: 'Code', label: 'JavaScript File' },
  'application/typescript': { previewType: 'text', icon: 'Code', label: 'TypeScript File' },

  // Office documents — previewType: 'office' (converted to HTML/table for inline preview)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    previewType: 'office', icon: 'FileText', label: 'Word Document',
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    previewType: 'office', icon: 'Spreadsheet', label: 'Excel Spreadsheet',
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    previewType: 'office', icon: 'Presentation', label: 'PowerPoint Presentation',
  },
  'application/msword': { previewType: 'office', icon: 'FileText', label: 'Word Document' },
  'application/vnd.ms-excel': { previewType: 'office', icon: 'Spreadsheet', label: 'Excel Spreadsheet' },
  'application/vnd.ms-powerpoint': { previewType: 'office', icon: 'Presentation', label: 'PowerPoint Presentation' },

  // Archives
  'application/zip': { previewType: 'none', icon: 'Archive', label: 'ZIP Archive' },
  'application/x-tar': { previewType: 'none', icon: 'Archive', label: 'TAR Archive' },
  'application/gzip': { previewType: 'none', icon: 'Archive', label: 'GZIP Archive' },
  'application/x-rar-compressed': { previewType: 'none', icon: 'Archive', label: 'RAR Archive' },
  'application/x-7z-compressed': { previewType: 'none', icon: 'Archive', label: '7-Zip Archive' },

  // Code / Dev files — previewType: 'text' (viewable as plain text)
  'application/x-python': { previewType: 'text', icon: 'Code', label: 'Python File' },
  'application/x-java': { previewType: 'text', icon: 'Code', label: 'Java File' },
  'application/x-c': { previewType: 'text', icon: 'Code', label: 'C Source File' },
  'application/x-cpp': { previewType: 'text', icon: 'Code', label: 'C++ Source File' },
  'application/x-shellscript': { previewType: 'text', icon: 'Code', label: 'Shell Script' },
  'text/x-python': { previewType: 'text', icon: 'Code', label: 'Python File' },
  'text/x-java': { previewType: 'text', icon: 'Code', label: 'Java Source File' },
  'text/x-c': { previewType: 'text', icon: 'Code', label: 'C Source File' },
  'text/x-c++': { previewType: 'text', icon: 'Code', label: 'C++ Source File' },
  'text/x-sh': { previewType: 'text', icon: 'Code', label: 'Shell Script' },
  'text/x-ruby': { previewType: 'text', icon: 'Code', label: 'Ruby File' },
  'text/x-go': { previewType: 'text', icon: 'Code', label: 'Go Source File' },
  'text/x-rust': { previewType: 'text', icon: 'Code', label: 'Rust Source File' },
  'text/x-swift': { previewType: 'text', icon: 'Code', label: 'Swift File' },
  'text/x-kotlin': { previewType: 'text', icon: 'Code', label: 'Kotlin File' },
  'text/x-sql': { previewType: 'text', icon: 'Code', label: 'SQL Script' },
  'text/x-yaml': { previewType: 'text', icon: 'Code', label: 'YAML File' },
  'text/x-toml': { previewType: 'text', icon: 'Code', label: 'TOML File' },
  'text/x-dockerfile': { previewType: 'text', icon: 'Code', label: 'Dockerfile' },
  'text/x-makefile': { previewType: 'text', icon: 'Code', label: 'Makefile' },
  'application/x-yaml': { previewType: 'text', icon: 'Code', label: 'YAML File' },
  'application/x-httpd-php': { previewType: 'text', icon: 'Code', label: 'PHP File' },
  'application/x-perl': { previewType: 'text', icon: 'Code', label: 'Perl Script' },
};

/**
 * Determine the preview type for a given MIME type.
 * Falls back to prefix-based matching, then 'none'.
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
  // Office document types (Open XML formats, legacy MS Office)
  if (mimeType.includes('officedocument') || mimeType.includes('msword') || mimeType.includes('ms-excel') || mimeType.includes('ms-powerpoint')) return 'office';

  return 'none';
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
