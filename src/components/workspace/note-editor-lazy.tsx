'use client';

// ============================================================
// MODUL 25.2: Note Editor Lazy — Dynamic import entry point
// This is the dynamic import entry for the TiptapEditor
// It enables code-splitting so the heavy editor bundle
// is only loaded when a note is actually being edited
// ============================================================

import { TiptapEditor } from '@/components/editor/tiptap-editor';

export default function NoteEditorLazy() {
  // This component exists solely as a dynamic import target
  // The actual editor logic is in TiptapEditor
  // By importing it here, Next.js can code-split the entire
  // TiptapEditor + all its dependencies into a separate chunk
  return null; // This component is never rendered directly
  // It's imported as: dynamic(() => import('@/components/workspace/note-editor-lazy'))
  // But the real component is used in note-editor.tsx wrapper
}

// Re-export TiptapEditor for the dynamic import
export { TiptapEditor };
