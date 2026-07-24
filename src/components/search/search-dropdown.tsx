'use client';

// ============================================================
// MODUL 12: SearchDropdown — Debounced search with realtime dropdown
// 12.4 — 300ms debounce, realtime dropdown, scope filter
// Keyboard navigation (arrow keys, Enter, Escape)
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearch, type SearchFilters, type SearchResult } from '@/hooks/use-search';
import { useFileTreeStore } from '@/store/file-tree';
import type { NodeType } from '@/types';
import {
  Folder,
  File,
  FileText,
  Search,
  Loader2,
  X,
  Keyboard,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SearchDropdownProps {
  onNavigateToNode?: (nodeId: string, nodeType: string, parentId: string | null) => void;
  className?: string;
}

export function SearchDropdown({ onNavigateToNode, className }: SearchDropdownProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [typeFilter, setTypeFilter] = useState<NodeType | undefined>(undefined);

  // 12.4 — isOpen is derived from whether query has content
  const isOpen = query.trim().length > 0;

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filters: SearchFilters = { type: typeFilter };
  const { data, isLoading } = useSearch(query, filters);
  const results = data?.results || [];

  const { setCurrentFolder, flatNodes } = useFileTreeStore();

  // Reset active index when query changes (derived from input, not effect)
  const resetActiveIndex = useCallback(() => setActiveIndex(-1), []);

  // Navigate to a search result
  const handleSelect = useCallback((result: SearchResult) => {
    setQuery('');
    setActiveIndex(-1);

    if (onNavigateToNode) {
      onNavigateToNode(result.id, result.type, result.parentId);
      return;
    }

    // Default navigation behavior using file tree store
    if (result.type === 'folder') {
      const folderNode = flatNodes.get(result.id);
      if (folderNode) {
        setCurrentFolder(result.id, []);
      }
    } else if (result.type === 'note') {
      if (result.parentId) {
        setCurrentFolder(result.parentId, []);
      }
    } else {
      if (result.parentId) {
        setCurrentFolder(result.parentId, []);
      }
    }
  }, [onNavigateToNode, flatNodes, setCurrentFolder]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        setQuery('');
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setQuery('');
        inputRef.current?.blur();
        break;
    }
  }, [isOpen, results, activeIndex, handleSelect]);

  // Close dropdown when clicking outside — only needed when dropdown is open
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'folder':
        return <Folder className="h-4 w-4 text-orange-500 shrink-0" />;
      case 'file':
        return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
      case 'note':
        return <FileText className="h-4 w-4 text-emerald-600 shrink-0" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const filterButtons: Array<{ label: string; value: NodeType | undefined }> = [
    { label: 'All', value: undefined },
    { label: 'Files', value: 'file' },
    { label: 'Folders', value: 'folder' },
    { label: 'Notes', value: 'note' },
  ];

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Search files, folders, notes..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            resetActiveIndex();
          }}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-9 h-9 w-full"
          aria-label="Search workspace"
          aria-expanded={isOpen}
          role="combobox"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
          role="listbox"
          aria-label="Search results"
        >
          {/* Scope Filter Buttons */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-muted/30">
            <span className="text-xs text-muted-foreground mr-1">Filter:</span>
            {filterButtons.map((btn) => (
              <Badge
                key={btn.label}
                variant={typeFilter === btn.value ? 'default' : 'outline'}
                className="cursor-pointer text-xs px-2 py-0.5 hover:bg-accent transition-colors"
                onClick={() => setTypeFilter(btn.value)}
                role="button"
                aria-pressed={typeFilter === btn.value}
              >
                {btn.label}
              </Badge>
            ))}
          </div>

          {/* Results */}
          <ScrollArea className="max-h-72">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground ml-2">Searching...</span>
              </div>
            )}

            {!isLoading && results.length === 0 && query.trim() && (
              <div className="py-8 text-center">
                <Search className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No results for &ldquo;{query}&rdquo;
                </p>
              </div>
            )}

            {!isLoading && results.length > 0 && (
              <div className="p-1">
                {results.map((result, index) => (
                  <div
                    key={result.id}
                    className={`flex items-start gap-3 p-2.5 rounded-md cursor-pointer transition-colors
                      ${activeIndex === index
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                      }
                    `}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setActiveIndex(index)}
                    role="option"
                    aria-selected={activeIndex === index}
                  >
                    <div className="mt-0.5">{getIcon(result.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {result.name}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize shrink-0">
                          {result.type}
                        </span>
                      </div>
                      {result.snippet && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {result.snippet}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(result.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer with shortcut hint */}
          <div className="px-3 py-2 border-t border-border bg-muted/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Keyboard className="h-3 w-3" />
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span>esc close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
