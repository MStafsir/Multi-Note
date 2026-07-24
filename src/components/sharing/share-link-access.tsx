'use client';

// ============================================================
// MODUL 13: ShareLinkAccess — View shared content via public link
// Read-only mode for view permission, comment/edit for higher permissions
// ============================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Eye,
  MessageSquare,
  Pencil,
  Download,
  Folder,
  FileText,
  File,
  Loader2,
  Lock,
  ArrowLeft,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ShareLinkAccessData, SharePermission } from '@/types';

interface ShareLinkAccessProps {
  token: string;
}

const PERMISSION_CONFIG: Record<SharePermission, { icon: typeof Eye; label: string; color: string }> = {
  view: { icon: Eye, label: 'View only', color: 'text-blue-600' },
  comment: { icon: MessageSquare, label: 'Can comment', color: 'text-orange-600' },
  edit: { icon: Pencil, label: 'Can edit', color: 'text-emerald-600' },
};

export function ShareLinkAccess({ token }: ShareLinkAccessProps) {
  const [localNoteContent, setLocalNoteContent] = useState<string>('');

  // Fetch shared content via token
  const shareQuery = useQuery({
    queryKey: ['share-link', token],
    queryFn: async () => {
      const res = await fetch(`/api/shares/link/${token}`);
      const data = await res.json();
      if (!data.success) {
        if (res.status === 403) throw new Error('EXPIRED');
        if (res.status === 404) throw new Error('NOT_FOUND');
        throw new Error(data.error);
      }
      return data.data as ShareLinkAccessData;
    },
    retry: false,
  });

  // Derive note content from query data (no useEffect setState)
  const noteContent = localNoteContent || shareQuery.data?.content || '';

  const handleNoteEdit = (value: string) => {
    setLocalNoteContent(value);
  };

  if (shareQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (shareQuery.error) {
    const errorMsg = shareQuery.error.message;
    if (errorMsg === 'EXPIRED') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Share link expired</h2>
          <p className="text-muted-foreground text-center max-w-md">
            This share link has expired. Please contact the owner for a new link.
          </p>
        </div>
      );
    }
    if (errorMsg === 'NOT_FOUND') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Share link not found</h2>
          <p className="text-muted-foreground text-center max-w-md">
            This share link does not exist or the shared content has been removed.
          </p>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Error accessing shared content</h2>
        <p className="text-muted-foreground text-center max-w-md">{errorMsg}</p>
      </div>
    );
  }

  const data = shareQuery.data;
  if (!data) return null;

  const permConfig = PERMISSION_CONFIG[data.permissionLevel];
  const PermIcon = permConfig.icon;
  const isReadOnly = data.isReadOnly;

  // Get icon for node type
  const getIcon = () => {
    switch (data.nodeType) {
      case 'folder':
        return <Folder className="h-6 w-6 text-orange-500" />;
      case 'note':
        return <FileText className="h-6 w-6 text-emerald-600" />;
      case 'file':
        return <File className="h-6 w-6 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            {getIcon()}
            <h1 className="font-semibold truncate">{data.nodeName}</h1>
          </div>
          <div className="flex-1" />
          <Badge variant="secondary" className={`flex items-center gap-1 ${permConfig.color}`}>
            <PermIcon className="h-3.5 w-3.5" />
            {permConfig.label}
          </Badge>
          {isReadOnly && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Lock className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>This content is shared as read-only</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              {getIcon()}
              {data.nodeName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Note content */}
            {data.nodeType === 'note' && (
              <div className="space-y-3">
                {isReadOnly ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert p-4 border rounded-lg bg-muted/20"
                    dangerouslySetInnerHTML={{
                      __html: noteContent
                        ? renderNoteContent(noteContent)
                        : '<p class="text-muted-foreground">No content yet.</p>',
                    }}
                  />
                ) : (
                  <textarea
                    className="w-full min-h-[300px] p-4 border rounded-lg resize-y text-sm"
                    value={noteContent}
                    onChange={(e) => handleNoteEdit(e.target.value)}
                    placeholder="Edit note content..."
                  />
                )}
                {!isReadOnly && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="shrink-0">
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Save
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      You can edit this shared note
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* File content */}
            {data.nodeType === 'file' && (
              <div className="space-y-3">
                {data.metadata && (
                  <div className="p-4 border rounded-lg bg-muted/20">
                    <div className="flex items-center gap-3">
                      <File className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{data.metadata.fileName}</p>
                        <p className="text-sm text-muted-foreground">
                          {data.metadata.mimeType} — {formatFileSize(data.metadata.sizeBytes || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {isReadOnly && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Download only — no editing allowed for shared files</span>
                  </div>
                )}
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download file
                </Button>
              </div>
            )}

            {/* Folder content */}
            {data.nodeType === 'folder' && (
              <div className="space-y-2">
                <Separator />
                <p className="text-sm text-muted-foreground">
                  Contents of this shared folder:
                </p>
                <ScrollArea className="max-h-96">
                  <div className="space-y-1">
                    {(data.children as Array<{ id: string; name: string; type: string }>)?.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                      >
                        {child.type === 'folder' ? (
                          <Folder className="h-4 w-4 text-orange-500 shrink-0" />
                        ) : child.type === 'note' ? (
                          <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <File className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm truncate">{child.name}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {child.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {isReadOnly && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Browsing only — no modifications allowed</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
        <p>Shared content — Unified Workspace</p>
      </footer>
    </div>
  );
}

// Helper: simple Tiptap JSON to HTML renderer (for read-only display)
function renderNoteContent(contentJson: string): string {
  try {
    const parsed = JSON.parse(contentJson);
    if (parsed.type === 'doc' && parsed.content) {
      return renderTiptapDoc(parsed.content);
    }
    return '<p>' + contentJson + '</p>';
  } catch {
    return '<p>' + contentJson + '</p>';
  }
}

function renderTiptapDoc(content: Array<Record<string, unknown>>): string {
  let html = '';
  for (const node of content) {
    switch (node.type) {
      case 'heading': {
        const level = (node.attrs?.level as number) || 1;
        const headingText = extractText(node);
        html += `<h${level}>${headingText}</h${level}>`;
        break;
      }
      case 'paragraph':
        html += `<p>${extractText(node)}</p>`;
        break;
      case 'bulletList':
        html += '<ul>' + renderListItems(node.content as Array<Record<string, unknown>>) + '</ul>';
        break;
      case 'orderedList':
        html += '<ol>' + renderListItems(node.content as Array<Record<string, unknown>>) + '</ol>';
        break;
      case 'codeBlock':
        html += `<pre><code>${extractText(node)}</code></pre>`;
        break;
      case 'blockquote':
        html += `<blockquote>${renderTiptapDoc(node.content as Array<Record<string, unknown>>)}</blockquote>`;
        break;
      case 'taskList':
        html += '<ul>' + renderListItems(node.content as Array<Record<string, unknown>>) + '</ul>';
        break;
      default:
        if (node.content) {
          html += renderTiptapDoc(node.content as Array<Record<string, unknown>>);
        }
        break;
    }
  }
  return html;
}

function renderListItems(items: Array<Record<string, unknown>>): string {
  let html = '';
  for (const item of items) {
    if (item.type === 'listItem' || item.type === 'taskItem') {
      const itemContent = item.content as Array<Record<string, unknown>>;
      html += '<li>' + renderTiptapDoc(itemContent) + '</li>';
    }
  }
  return html;
}

function extractText(node: Record<string, unknown>): string {
  if (typeof node.text === 'string') {
    return node.text;
  }
  if (Array.isArray(node.content)) {
    return (node.content as Array<Record<string, unknown>>).map(extractText).join('');
  }
  return '';
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
