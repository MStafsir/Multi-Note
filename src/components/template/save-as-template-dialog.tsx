// ============================================================
// MODUL 33.4: Save as Template Dialog — Convert note to template
// Title input, category selector, "Strip embedded file references" toggle
// ============================================================

'use client';

import { useState } from 'react';
import { LayoutTemplate, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSaveAsTemplate } from '@/hooks/use-templates';
import type { TemplateCategory } from '@/types';

const CATEGORY_OPTIONS: { value: TemplateCategory; label: string }[] = [
  { value: 'meeting_notes', label: 'Meeting Notes' },
  { value: 'project_plan', label: 'Project Plan' },
  { value: 'journal', label: 'Journal' },
  { value: 'weekly_review', label: 'Weekly Review' },
  { value: 'blank', label: 'Blank' },
  { value: 'custom', label: 'Custom' },
];

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string;
  nodeName: string;
  hasEmbeddedFiles?: boolean;
  onSaved?: (templateId: string) => void;
}

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  nodeId,
  nodeName,
  hasEmbeddedFiles,
  onSaved,
}: SaveAsTemplateDialogProps) {
  const [title, setTitle] = useState(nodeName);
  const [category, setCategory] = useState<TemplateCategory>('custom');
  const [stripEmbeddedFiles, setStripEmbeddedFiles] = useState(false);

  const saveAsTemplate = useSaveAsTemplate();

  const handleSave = () => {
    if (!title.trim()) return;

    saveAsTemplate.mutate(
      {
        nodeId,
        title: title.trim(),
        category,
        stripEmbeddedFiles,
      },
      {
        onSuccess: (data) => {
          onSaved?.(data.id);
          onOpenChange(false);
          // Reset state
          setTitle(nodeName);
          setCategory('custom');
          setStripEmbeddedFiles(false);
        },
      }
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTitle(nodeName);
      setCategory('custom');
      setStripEmbeddedFiles(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-emerald-600" />
            Save as Template
          </DialogTitle>
          <DialogDescription>
            Convert &quot;{nodeName}&quot; into a reusable template. Database blocks will be replaced with placeholders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title input */}
          <div className="space-y-2">
            <Label htmlFor="template-title">Template title</Label>
            <Input
              id="template-title"
              placeholder="Enter template title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              disabled={saveAsTemplate.isPending}
            />
          </div>

          {/* Category selector */}
          <div className="space-y-2">
            <Label htmlFor="template-category">Category</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as TemplateCategory)}
              disabled={saveAsTemplate.isPending}
            >
              <SelectTrigger id="template-category" className="min-h-[44px]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Embedded files toggle — 33.4 */}
          {hasEmbeddedFiles && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Strip embedded file references</Label>
                  <p className="text-xs text-muted-foreground">
                    When ON: replaces embedded files with placeholder text in the template.
                    When OFF: keeps file references (users may not have access to originals).
                  </p>
                </div>
                <Switch
                  checked={stripEmbeddedFiles}
                  onCheckedChange={setStripEmbeddedFiles}
                  aria-label="Toggle: strip embedded file references from template"
                />
              </div>
              {!stripEmbeddedFiles && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs h-5">
                    Keep file references
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    — users may need to replace them
                  </span>
                </div>
              )}
              {stripEmbeddedFiles && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs h-5 text-destructive">
                    Strip files
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    — replaced with placeholder text
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Info note about database blocks */}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <strong>Note:</strong> Database blocks in your note will be replaced with placeholders
            in the template. When creating a note from this template, you&apos;ll need to set up new databases.
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saveAsTemplate.isPending}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || saveAsTemplate.isPending}
            className="min-h-[44px]"
          >
            {saveAsTemplate.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <LayoutTemplate className="mr-2 h-4 w-4" />
            Save as Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
