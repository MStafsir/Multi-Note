// ============================================================
// MODUL 33.6: Template Gallery Dialog — Create note from template
// Shows template gallery with:
//   - Preview thumbnail cards
//   - Category filter tabs
//   - Search by title
//   - "Create from template" button
//   - "Blank note" option
// ============================================================

'use client';

import { useState, useMemo } from 'react';
import { Search, FileText, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TemplatePreviewCard } from '@/components/template/template-preview-card';
import { useTemplates, useCreateFromTemplate, useDeleteTemplate } from '@/hooks/use-templates';
import type { NoteTemplateInfo, TemplateCategory } from '@/types';

// Category labels for tabs
const CATEGORY_TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'meeting_notes', label: 'Meeting Notes' },
  { value: 'project_plan', label: 'Project Plan' },
  { value: 'journal', label: 'Journal' },
  { value: 'weekly_review', label: 'Weekly Review' },
  { value: 'blank', label: 'Blank' },
  { value: 'custom', label: 'Custom' },
];

interface TemplateGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string | null;
  userId?: string;
  onTemplateUsed?: (newNoteId: string, noteName: string) => void;
}

export function TemplateGalleryDialog({
  open,
  onOpenChange,
  parentId,
  userId,
  onTemplateUsed,
}: TemplateGalleryDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState<NoteTemplateInfo | null>(null);

  // Fetch templates with current filters
  const categoryFilter = activeCategory === 'all' ? undefined : activeCategory as TemplateCategory;
  const { data: templates, isLoading } = useTemplates({
    category: categoryFilter,
    search: searchQuery || undefined,
  });

  const createFromTemplate = useCreateFromTemplate();
  const deleteTemplate = useDeleteTemplate();

  // Handle "Use template" button
  const handleUseTemplate = (template: NoteTemplateInfo) => {
    createFromTemplate.mutate(
      {
        templateId: template.id,
        name: template.title,
        parentId: parentId || null,
        contentJsonTemplate: template.contentJsonTemplate,
      },
      {
        onSuccess: (data) => {
          onTemplateUsed?.(data.id, data.name);
          onOpenChange(false);
          setSearchQuery('');
          setActiveCategory('all');
          setSelectedTemplate(null);
        },
      }
    );
  };

  // Handle "Blank note" creation
  const handleCreateBlank = () => {
    const blankContent = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });

    createFromTemplate.mutate(
      {
        templateId: '',
        name: 'Untitled Note',
        parentId: parentId || null,
        contentJsonTemplate: blankContent,
      },
      {
        onSuccess: (data) => {
          onTemplateUsed?.(data.id, data.name);
          onOpenChange(false);
          setSearchQuery('');
          setActiveCategory('all');
          setSelectedTemplate(null);
        },
      }
    );
  };

  // Handle template delete
  const handleDeleteTemplate = (template: NoteTemplateInfo) => {
    deleteTemplate.mutate({ id: template.id });
  };

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSearchQuery('');
      setActiveCategory('all');
      setSelectedTemplate(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            Create from Template
          </DialogTitle>
          <DialogDescription>
            Choose a template to start your note, or create a blank note.
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="flex items-center gap-2 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
              aria-label="Search templates by title"
            />
          </div>
        </div>

        {/* Category filter tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="w-full flex-wrap h-auto gap-0.5">
            {CATEGORY_TABS.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-xs min-h-[44px]"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Template grid */}
          <TabsContent value={activeCategory} className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading templates...</span>
              </div>
            ) : templates && templates.length > 0 ? (
              <ScrollArea className="max-h-[50vh]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                  {templates.map(template => (
                    <TemplatePreviewCard
                      key={template.id}
                      template={template}
                      onUse={handleUseTemplate}
                      onDelete={handleDeleteTemplate}
                      currentUserId={userId}
                    />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                No templates found matching your search.
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Blank note option */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Or create a blank note without a template</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={handleCreateBlank}
            disabled={createFromTemplate.isPending}
            aria-label="Create blank note"
          >
            {createFromTemplate.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Blank Note
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
