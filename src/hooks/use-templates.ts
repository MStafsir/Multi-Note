// ============================================================
// MODUL 33: React Query Hooks — Templates, Duplicate, Save-as-Template
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { NoteTemplateInfo, TemplateCategory } from '@/types';

// --- Query Keys ---
const TEMPLATE_KEYS = {
  all: ['templates'] as const,
  list: (filters?: { category?: string; search?: string }) => ['templates', 'list', filters] as const,
  detail: (id: string) => ['templates', 'detail', id] as const,
};

// --- GET: Fetch all templates (system + user's own) ---
export function useTemplates(filters?: { category?: TemplateCategory; search?: string }) {
  return useQuery({
    queryKey: TEMPLATE_KEYS.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.category) params.set('category', filters.category);
      if (filters?.search) params.set('search', filters.search);
      const res = await fetch(`/api/templates?${params.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as NoteTemplateInfo[];
    },
    staleTime: 30000,
  });
}

// --- GET: Fetch system templates only ---
export function useSystemTemplates() {
  return useQuery({
    queryKey: ['templates', 'system'],
    queryFn: async () => {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return (data.data as NoteTemplateInfo[]).filter(t => t.ownerId === null);
    },
    staleTime: 60000, // System templates change rarely
  });
}

// --- GET: Fetch single template ---
export function useTemplate(id: string) {
  return useQuery({
    queryKey: TEMPLATE_KEYS.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/templates/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as NoteTemplateInfo;
    },
    enabled: !!id,
    staleTime: 30000,
  });
}

// --- POST: Create a new template ---
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      title: string;
      contentJsonTemplate: string;
      category: TemplateCategory;
    }) => {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as NoteTemplateInfo;
    },
    onSuccess: (newTemplate) => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_KEYS.all });
      toast.success(`Template "${newTemplate.title}" created`);
    },
    onError: (error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });
}

// --- PATCH: Update template ---
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      title?: string;
      contentJsonTemplate?: string;
      category?: TemplateCategory;
    }) => {
      const res = await fetch(`/api/templates/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: params.title,
          contentJsonTemplate: params.contentJsonTemplate,
          category: params.category,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as NoteTemplateInfo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_KEYS.all });
      toast.success('Template updated');
    },
    onError: (error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });
}

// --- DELETE: Delete template ---
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_KEYS.all });
      toast.success('Template deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });
}

// --- POST: Duplicate a note ---
export function useDuplicateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      nodeId: string;
      copyDatabaseData?: boolean;
      stripEmbeddedFiles?: boolean;
    }) => {
      const res = await fetch(`/api/nodes/${params.nodeId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: params.nodeId,
          copyDatabaseData: params.copyDatabaseData ?? false,
          stripEmbeddedFiles: params.stripEmbeddedFiles ?? false,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.success('Note duplicated');
    },
    onError: (error) => {
      toast.error(`Failed to duplicate note: ${error.message}`);
    },
  });
}

// --- POST: Save note as template ---
export function useSaveAsTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      nodeId: string;
      title: string;
      category?: TemplateCategory;
      stripEmbeddedFiles?: boolean;
    }) => {
      const res = await fetch(`/api/nodes/${params.nodeId}/save-as-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: params.nodeId,
          title: params.title,
          category: params.category ?? 'custom',
          stripEmbeddedFiles: params.stripEmbeddedFiles ?? false,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as NoteTemplateInfo;
    },
    onSuccess: (newTemplate) => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_KEYS.all });
      toast.success(`Saved as template "${newTemplate.title}"`);
    },
    onError: (error) => {
      toast.error(`Failed to save as template: ${error.message}`);
    },
  });
}

// --- Create note from template ---
// This uses the existing /api/nodes POST endpoint but with template content
export function useCreateFromTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      templateId: string;
      name: string;
      parentId?: string | null;
      contentJsonTemplate: string;
    }) => {
      // Create a new note node with the template content
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'note',
          name: params.name,
          parentId: params.parentId || null,
          contentJson: params.contentJsonTemplate,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.success('Note created from template');
    },
    onError: (error) => {
      toast.error(`Failed to create note from template: ${error.message}`);
    },
  });
}
