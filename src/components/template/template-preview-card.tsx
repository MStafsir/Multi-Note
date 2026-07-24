// ============================================================
// MODUL 33.6: Template Preview Card — Shows template info in gallery
// Displays title, category badge, truncated preview text,
// and action buttons (Use, Edit, Delete for user templates)
// ============================================================

'use client';

import { useMemo } from 'react';
import { FileText, Pencil, Trash2, LayoutTemplate, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { NoteTemplateInfo, TemplateCategory } from '@/types';

// Category color mapping
const CATEGORY_COLORS: Record<TemplateCategory, { bg: string; text: string }> = {
  meeting_notes: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  project_plan: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
  journal: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  weekly_review: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  blank: { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-600 dark:text-neutral-400' },
  custom: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
};

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  meeting_notes: 'Meeting Notes',
  project_plan: 'Project Plan',
  journal: 'Journal',
  weekly_review: 'Weekly Review',
  blank: 'Blank',
  custom: 'Custom',
};

// Extract plain text preview from Tiptap JSON content
function extractPreviewText(contentJson: string, maxLength: number = 100): string {
  try {
    const doc = JSON.parse(contentJson);
    const texts: string[] = [];

    function walk(node: Record<string, unknown>) {
      if (node.type === 'text' && typeof node.text === 'string') {
        texts.push(node.text as string);
      }
      if (node.content && Array.isArray(node.content)) {
        for (const child of node.content as Record<string, unknown>[]) {
          walk(child);
        }
      }
    }

    walk(doc as Record<string, unknown>);

    const fullText = texts.join(' ');
    if (fullText.length <= maxLength) return fullText;
    return fullText.substring(0, maxLength) + '...';
  } catch {
    return 'Preview unavailable';
  }
}

interface TemplatePreviewCardProps {
  template: NoteTemplateInfo;
  onUse?: (template: NoteTemplateInfo) => void;
  onEdit?: (template: NoteTemplateInfo) => void;
  onDelete?: (template: NoteTemplateInfo) => void;
  currentUserId?: string;
}

export function TemplatePreviewCard({
  template,
  onUse,
  onEdit,
  onDelete,
  currentUserId,
}: TemplatePreviewCardProps) {
  const previewText = useMemo(
    () => extractPreviewText(template.contentJsonTemplate),
    [template.contentJsonTemplate]
  );

  const isSystem = template.ownerId === null;
  const isOwner = template.ownerId === currentUserId;
  const categoryColor = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.custom;
  const categoryLabel = CATEGORY_LABELS[template.category] || template.category;

  return (
    <Card className="group hover:shadow-md transition-shadow cursor-pointer border-border">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <LayoutTemplate className="h-4 w-4 text-muted-foreground shrink-0" />
            <CardTitle className="text-sm font-medium truncate">
              {template.title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isSystem && (
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                <Star className="h-3 w-3 mr-0.5" />
                Built-in
              </Badge>
            )}
            {!isSystem && (
              <Badge variant="outline" className="text-xs h-5 px-1.5">
                Custom
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Category badge */}
          <Badge
            className={`${categoryColor.bg} ${categoryColor.text} text-xs h-5 px-1.5 border-0`}
          >
            {categoryLabel}
          </Badge>

          {/* Preview text */}
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed min-h-[3rem]">
            {previewText}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 pt-1">
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs min-h-[44px] min-w-[44px]"
              onClick={() => onUse?.(template)}
              aria-label={`Use template "${template.title}"`}
            >
              <FileText className="h-3 w-3 mr-1" />
              Use
            </Button>

            {isOwner && onEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs min-h-[44px] min-w-[44px]"
                onClick={() => onEdit(template)}
                aria-label={`Edit template "${template.title}"`}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}

            {isOwner && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive min-h-[44px] min-w-[44px]"
                onClick={() => onDelete(template)}
                aria-label={`Delete template "${template.title}"`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
