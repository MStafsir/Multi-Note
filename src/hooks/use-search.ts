// ============================================================
// MODUL 12: useSearch React Query Hook — Debounced search
// 12.4 — Debounce 300ms before firing search query
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import type { NodeType } from '@/types';

export interface SearchResult {
  id: string;
  type: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  snippet: string | null;
  metadata: Record<string, unknown> | null;
}

export interface SearchFilters {
  type?: NodeType;
  dateFrom?: string;
  dateTo?: string;
  tags?: string; // comma-separated tag IDs (Modul 21)
  tagMode?: 'AND' | 'OR'; // tag filter mode (Modul 21)
}

const SEARCH_KEYS = {
  search: (query: string, filters: SearchFilters) =>
    ['search', query, filters] as const,
};

export function useSearch(query: string, filters: SearchFilters = {}) {
  // 12.4 — Debounce the query 300ms
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return useQuery({
    queryKey: SEARCH_KEYS.search(debouncedQuery, filters),
    queryFn: async () => {
      if (!debouncedQuery.trim()) return { results: [], total: 0 };

      const params = new URLSearchParams();
      params.set('q', debouncedQuery.trim());
      if (filters.type) params.set('type', filters.type);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.tags) params.set('tags', filters.tags); // 21
      if (filters.tagMode) params.set('tagMode', filters.tagMode); // 21

      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);
      return data.data as { results: SearchResult[]; total: number };
    },
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 30000,
  });
}

// ============================================================
// Helper: useDebouncedValue — generic debounce hook
// ============================================================
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
