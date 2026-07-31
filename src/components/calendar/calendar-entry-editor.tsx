'use client';

// ============================================================
// MODUL 81: Calendar Entry Editor — Reuse existing NoteEditor
// Opens as modal overlay for editing calendar entries
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCalendarStore, CalendarEntry } from '@/store/calendar';

export function CalendarEntryEditor({ entry, onClose }: { entry: CalendarEntry; onClose: () => void }) {
  const [name, setName] = useState(entry.name);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [contentJson, setContentJson] = useState<string>(
    entry.content?.contentJson ?? JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
  );
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Save handler with debounce (Modul 81.6 — reuse 800ms pattern)
  const saveNote = useCallback(async (newName: string, newContent: string) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/nodes/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newName: newName,
          contentJson: newContent,
        }),
      });
      if (res.ok) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('unsaved');
      }
    } catch {
      setSaveStatus('unsaved');
    }
  }, [entry.id]);

  // Debounced save on name change
  useEffect(() => {
    if (name === entry.name) return;
    // Using setTimeout inside effect is intentional for debouncing —
    // the state update happens in the callback, not synchronously in the effect body
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSaveStatus('unsaved');
      saveNote(name, contentJson);
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, entry.name, contentJson, saveNote]);

  // Simple content editor with basic formatting support
  // For full Tiptap editor, we'd use the existing NoteEditor component
  // but in a modal context it's simpler to use a contentEditable approach
  // that still saves to the same contentJson format

  const handleContentChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    // Simple approach: save as plain text paragraph
    const text = el.innerText;
    const paragraphs = text.split('\n').filter(Boolean).map(p => ({
      type: 'paragraph',
      content: p ? [{ type: 'text', text: p }] : undefined,
    }));
    const newJson = JSON.stringify({
      type: 'doc',
      content: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph' }],
    });
    setContentJson(newJson);
    setSaveStatus('unsaved');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNote(name, newJson);
    }, 800);
  }, [name, saveNote]);

  // Parse contentJson for display
  const getDisplayContent = () => {
    try {
      const doc = JSON.parse(contentJson);
      const texts: string[] = [];
      const extractText = (node: Record<string, unknown>) => {
        if (node.type === 'text' && typeof node.text === 'string') {
          texts.push(node.text);
        }
        if (Array.isArray(node.content)) {
          for (const child of node.content) {
            extractText(child as Record<string, unknown>);
          }
        }
      };
      if (Array.isArray(doc.content)) {
        for (const child of doc.content) {
          extractText(child as Record<string, unknown>);
        }
      }
      return texts.join('\n');
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm font-medium h-8 border-transparent hover:border-border focus:border-border"
              placeholder="Judul entry..."
            />
            {saveStatus === 'saved' && (
              <Check className="h-4 w-4 text-green-500 shrink-0" />
            )}
            {saveStatus === 'saving' && (
              <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content Editor */}
        <div className="flex-1 overflow-y-auto p-4">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[200px] text-sm outline-none whitespace-pre-wrap"
            onInput={handleContentChange}
          >
            {getDisplayContent()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {saveStatus === 'saved' ? 'Tersimpan' : saveStatus === 'saving' ? 'Menyimpan...' : 'Belum tersimpan'}
          </span>
          <Button size="sm" className="h-7 text-xs" onClick={() => saveNote(name, contentJson)}>
            <Save className="h-3 w-3 mr-1" />
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}
