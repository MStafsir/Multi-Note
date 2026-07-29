---
Task ID: 3
Agent: main
Task: Fix DOCX preview text visibility, image preview, and dedicated viewer Google Drive-style rendering

Work Log:
- Analyzed 5 uploaded screenshots using VLM to understand the visual issues
- Identified root cause: dark mode CSS (.dark class on html) overrides text color to near-white, making DOCX text invisible on white background
- Fixed globals.css: Added .docx-preview-wrapper CSS override with !important to force black text on white background
- Fixed dedicated-viewer.tsx: Updated DOCX, image, text/code, PDF rendering sections with forced black text, A4 paper styling, Google Drive-like gray background
- Fixed file-preview.tsx: Updated mammoth HTML rendering, docx-preview container, image preview, and text/code preview with forced black text
- Created test files on disk for test user (test-upload.txt, large-test-file.bin)
- Created database entries for test files (DOCX, PDF, PNG)
- Tested all file types with agent-browser: DOCX viewer shows clear text, image viewer works, PDF viewer works, text viewer works

Stage Summary:
- DOCX preview text is now clearly visible with forced black text on white background
- Image preview renders correctly with white background
- Dedicated viewer has Google Drive-style gray background with white A4 paper
- PDF viewer renders all pages with zoom controls
- Text/code viewer renders with A4 paper styling
- All file types tested and working via agent-browser
