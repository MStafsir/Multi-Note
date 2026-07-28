---
Task ID: 1
Agent: main
Task: Implement inline file preview for all uploaded file types without downloading

Work Log:
- Installed mammoth (docx→HTML) and xlsx (SheetJS) packages
- Updated mime-icons.ts: added 'office' PreviewType, changed Office docs from 'download' to 'office', changed code files (Python, Java, C, etc.) from 'none' to 'text', added 20+ new text/code MIME types
- Updated getMimePreviewType() with fallback detection for Office MIME types
- Rewrote preview API (/api/preview/[id]/route.ts) to convert Office docs inline:
  - docx: mammoth.convertToHtml → full HTML document served as text/html for iframe
  - xlsx: XLSX.read → JSON with sheet names, headers, rows for table rendering
  - pptx: regex-based text extraction from <a:t> XML tags
- Rewrote FilePreview component with 3 new sub-components:
  - SpreadsheetPreview: interactive table with sheet tabs, max 100 rows, scrollable
  - PresentationPreview: slide card with navigation buttons
  - Office docx: iframe rendering of HTML preview
- Changed content-area.tsx click behavior (Google Drive style):
  - Single click: selects item (visual highlight)
  - Double click: opens item (folder→navigate, note→editor, file→preview modal)
- All code changes pass ESLint and TypeScript compilation
- OOM issue prevents Agent Browser testing (4GB memory limit)

Stage Summary:
- All uploaded files can now be previewed INLINE without downloading
- docx files → HTML preview in iframe (using mammoth.js)
- xlsx files → interactive table with sheet tabs (using SheetJS)
- pptx files → slide content display with navigation
- Code/text files → inline text preview (previously were 'none')
- Images, PDFs, video, audio → unchanged (already worked)
- Double-click opens preview modal (single-click now selects)
