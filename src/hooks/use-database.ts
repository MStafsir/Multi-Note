// ============================================================
// MODUL 31-32: React Query Hooks — Database CRUD, Rows, Views, Formula Evaluation
// Key structure: ['databases', ...] — invalidation on mutations
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  NoteDatabaseInfo,
  DatabaseRowInfo,
  DatabaseViewInfo,
  DatabaseViewConfig,
  ColumnSchema,
  FilterGroup,
  SortDefinition,
  DatabaseViewType,
} from '@/types';

// --- Query Keys ---
const DATABASE_KEYS = {
  all: ['databases'] as const,
  list: (parentNoteId?: string) => ['databases', 'list', parentNoteId] as const,
  detail: (id: string) => ['databases', 'detail', id] as const,
  rows: (id: string, viewId?: string, page?: number) => ['databases', id, 'rows', viewId, page] as const,
  views: (id: string) => ['databases', id, 'views'] as const,
};

// ============================================================
// Database CRUD Hooks
// ============================================================

// GET: List databases (optionally filtered by parentNoteId)
export function useDatabases(parentNoteId?: string) {
  return useQuery({
    queryKey: DATABASE_KEYS.list(parentNoteId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (parentNoteId) params.set('parentNoteId', parentNoteId);

      const res = await fetch(`/api/databases?${params.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as NoteDatabaseInfo[];
    },
    staleTime: 30000,
  });
}

// GET: Get single database with schema + rows + views
export function useDatabase(id: string) {
  return useQuery({
    queryKey: DATABASE_KEYS.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/databases/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as NoteDatabaseInfo & { rows: DatabaseRowInfo[]; views: DatabaseViewInfo[] };
    },
    enabled: !!id,
    staleTime: 30000,
  });
}

// POST: Create a new database
export function useCreateDatabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      parentNoteId: string;
      title?: string;
      schema: ColumnSchema[];
    }) => {
      const res = await fetch('/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as NoteDatabaseInfo;
    },
    onSuccess: (newDb) => {
      queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.list(newDb.parentNoteId) });
      toast.success(`Database "${newDb.title}" created`);
    },
    onError: (error) => {
      toast.error(`Failed to create database: ${error.message}`);
    },
  });
}

// PATCH: Update database title or schema
export function useUpdateDatabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      title?: string;
      schema?: ColumnSchema[];
    }) => {
      const res = await fetch(`/api/databases/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: params.title,
          schema: params.schema,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as NoteDatabaseInfo;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.detail(updated.id) });
      queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.list() });
      toast.success(`Database updated`);
    },
    onError: (error) => {
      toast.error(`Failed to update database: ${error.message}`);
    },
  });
}

// DELETE: Delete database
export function useDeleteDatabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await fetch(`/api/databases/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.all });
      toast.success('Database deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete database: ${error.message}`);
    },
  });
}

// ============================================================
// Row CRUD Hooks
// ============================================================

// GET: Get rows for a database (with filter/sort/view params)
export function useDatabaseRows(
  databaseId: string,
  options?: {
    viewId?: string;
    filters?: FilterGroup;
    sorts?: SortDefinition[];
    page?: number;
    pageSize?: number;
  }
) {
  return useQuery({
    queryKey: DATABASE_KEYS.rows(databaseId, options?.viewId, options?.page),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.viewId) params.set('viewId', options.viewId);
      if (options?.filters) params.set('filters', JSON.stringify(options.filters));
      if (options?.sorts) params.set('sorts', JSON.stringify(options.sorts));
      if (options?.page) params.set('page', String(options.page));
      if (options?.pageSize) params.set('pageSize', String(options.pageSize));

      const res = await fetch(`/api/databases/${databaseId}/rows?${params.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as {
        rows: DatabaseRowInfo[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    },
    enabled: !!databaseId,
    staleTime: 10000,
  });
}

// POST: Create a new row
export function useCreateRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      databaseId: string;
      cellData?: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/databases/${params.databaseId}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseId: params.databaseId,
          cellData: params.cellData ?? {},
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as DatabaseRowInfo;
    },
    onSuccess: (newRow) => {
      queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.rows(newRow.databaseId) });
      queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.detail(newRow.databaseId) });
    },
    onError: (error) => {
      toast.error(`Failed to create row: ${error.message}`);
    },
  });
}

// PATCH: Update row cell data (inline cell editing — autosave debounce 500ms)
export function useUpdateRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      databaseId: string;
      rowId: string;
      cellData: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/databases/${params.databaseId}/rows/${params.rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cellData: params.cellData }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as DatabaseRowInfo;
    },
    // Optimistic update: immediately update the row in cache
    onMutate: async (params) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: DATABASE_KEYS.rows(params.databaseId) });

      // Snapshot the previous value
      const previousRows = queryClient.getQueryData(DATABASE_KEYS.rows(params.databaseId));

      // Optimistically update the row in cache
      queryClient.setQueryData(
        DATABASE_KEYS.rows(params.databaseId),
        (old: { rows: DatabaseRowInfo[]; total: number; page: number; pageSize: number; totalPages: number } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            rows: old.rows.map(row =>
              row.id === params.rowId
                ? { ...row, cellData: { ...row.cellData, ...params.cellData } as Record<string, unknown> }
                : row
            ),
          };
        }
      );

      return { previousRows };
    },
    onSuccess: (_data, params) => {
      // Don't invalidate immediately — let optimistic update persist
      // Invalidate after a short delay to sync with server
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.rows(params.databaseId) });
      }, 1000);
    },
    onError: (error, params, context) => {
      // Rollback optimistic update
      if (context?.previousRows) {
        queryClient.setQueryData(DATABASE_KEYS.rows(params.databaseId), context.previousRows);
      }
      toast.error(`Failed to update cell: ${error.message}`);
    },
  });
}

// DELETE: Delete a row
export function useDeleteRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      databaseId: string;
      rowId: string;
    }) => {
      const res = await fetch(`/api/databases/${params.databaseId}/rows/${params.rowId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: DATABASE_KEYS.rows(params.databaseId) });

      const previousRows = queryClient.getQueryData(DATABASE_KEYS.rows(params.databaseId));

      // Optimistically remove the row from cache
      queryClient.setQueryData(
        DATABASE_KEYS.rows(params.databaseId),
        (old: { rows: DatabaseRowInfo[]; total: number; page: number; pageSize: number; totalPages: number } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            rows: old.rows.filter(row => row.id !== params.rowId),
            total: old.total - 1,
          };
        }
      );

      return { previousRows };
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.rows(params.databaseId) });
      queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.detail(params.databaseId) });
    },
    onError: (error, params, context) => {
      if (context?.previousRows) {
        queryClient.setQueryData(DATABASE_KEYS.rows(params.databaseId), context.previousRows);
      }
      toast.error(`Failed to delete row: ${error.message}`);
    },
  });
}

// ============================================================
// View CRUD Hooks
// ============================================================

// GET: List views for a database
export function useDatabaseViews(databaseId: string) {
  return useQuery({
    queryKey: DATABASE_KEYS.views(databaseId),
    queryFn: async () => {
      const res = await fetch(`/api/databases/${databaseId}/views`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as DatabaseViewInfo[];
    },
    enabled: !!databaseId,
    staleTime: 30000,
  });
}

// POST: Create a new view
export function useCreateView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      databaseId: string;
      type: DatabaseViewType;
      name?: string;
      config?: DatabaseViewConfig;
    }) => {
      const res = await fetch(`/api/databases/${params.databaseId}/views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as DatabaseViewInfo;
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.views(params.databaseId) });
      toast.success('View created');
    },
    onError: (error) => {
      toast.error(`Failed to create view: ${error.message}`);
    },
  });
}

// PATCH: Update view config (filters, sorts, groupBy, etc.)
export function useUpdateView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      databaseId: string;
      viewId: string;
      name?: string;
      type?: DatabaseViewType;
      config?: DatabaseViewConfig;
    }) => {
      const url = `/api/databases/${params.databaseId}/views?viewId=${params.viewId}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: params.name,
          type: params.type,
          config: params.config,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as DatabaseViewInfo;
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.views(params.databaseId) });
      queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.rows(params.databaseId) });
    },
    onError: (error) => {
      toast.error(`Failed to update view: ${error.message}`);
    },
  });
}

// DELETE: Delete a view
export function useDeleteView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      databaseId: string;
      viewId: string;
    }) => {
      const url = `/api/databases/${params.databaseId}/views?viewId=${params.viewId}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: DATABASE_KEYS.views(params.databaseId) });
      toast.success('View deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete view: ${error.message}`);
    },
  });
}
