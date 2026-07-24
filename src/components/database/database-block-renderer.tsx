// ============================================================
// MODUL 31.1 & 32.1: Database Block Renderer — Renders DatabaseBlock inside Tiptap editor
// When Tiptap encounters a DatabaseBlock node, this component renders the database
// inline with view selector, filter/sort controls, and inline editing
// ============================================================

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Database, LayoutTable, LayoutGrid, List, ImageIcon, Plus, Settings, Filter, ArrowUpDown, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatabaseTableView } from './database-table-view';
import { DatabaseBoardView } from './database-board-view';
import { DatabaseListView } from './database-list-view';
import { DatabaseGalleryView } from './database-gallery-view';
import { FilterBuilder, createEmptyFilterGroup } from './filter-builder';
import { SortBuilder } from './sort-builder';
import {
  useDatabase,
  useDatabaseViews,
  useCreateView,
  useUpdateView,
  useDeleteView,
  useUpdateDatabase,
} from '@/hooks/use-database';
import type {
  DatabaseViewType,
  DatabaseViewInfo,
  ColumnSchema,
  FilterGroup,
  SortDefinition,
  DatabaseViewConfig,
  NoteDatabaseInfo,
  DatabaseRowInfo,
} from '@/types';

interface DatabaseBlockRendererProps {
  databaseId: string;
  onDelete?: () => void;
}

export function DatabaseBlockRenderer({ databaseId, onDelete }: DatabaseBlockRendererProps) {
  // State for current view
  const [activeViewType, setActiveViewType] = useState<DatabaseViewType>('table');
  const [activeViewId, setActiveViewId] = useState<string | undefined>(undefined);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [showSortBuilder, setShowSortBuilder] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterGroup>(createEmptyFilterGroup());
  const [localSorts, setLocalSorts] = useState<SortDefinition[]>([]);
  const [boardGroupBy, setBoardGroupBy] = useState<string>('');

  // Fetch database data
  const databaseQuery = useDatabase(databaseId);
  const viewsQuery = useDatabaseViews(databaseId);

  const database = databaseQuery.data;
  const views = viewsQuery.data ?? [];

  // Find first select column for board grouping
  const defaultGroupByColumn = useMemo(() => {
    if (!database) return '';
    const selectCol = database.schema.find(c => c.type === 'select');
    return selectCol?.column_id ?? '';
  }, [database]);

  // Initialize boardGroupBy when database loads
  useState(() => {
    if (!boardGroupBy && defaultGroupByColumn) {
      setBoardGroupBy(defaultGroupByColumn);
    }
  });

  if (!database) {
    return (
      <div className="flex items-center justify-center py-8 border rounded-lg bg-muted/30">
        <Database className="h-5 w-5 animate-pulse text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading database...</span>
      </div>
    );
  }

  if (databaseQuery.error) {
    return (
      <div className="flex items-center justify-center py-8 border rounded-lg bg-destructive/10">
        <span className="text-sm text-destructive">Failed to load database: {databaseQuery.error.message}</span>
      </div>
    );
  }

  const columns = database.schema;

  // View type icons
  const viewTypeIcons: Record<DatabaseViewType, React.ReactNode> = {
    table: <LayoutTable className="h-4 w-4" />,
    board: <LayoutGrid className="h-4 w-4" />,
    list: <List className="h-4 w-4" />,
    gallery: <ImageIcon className="h-4 w-4" />,
  };

  const handleViewTypeChange = (type: DatabaseViewType) => {
    setActiveViewType(type);
    if (type === 'board' && !boardGroupBy) {
      setBoardGroupBy(defaultGroupByColumn);
    }
  };

  const handleSortChange = (sorts: SortDefinition[]) => {
    setLocalSorts(sorts);
  };

  const handleFilterColumn = (columnId: string) => {
    setShowFilterBuilder(true);
    // Add a condition for the specified column
    const newCondition = {
      columnId,
      operator: 'equals',
      value: undefined,
    };
    setLocalFilters({
      ...localFilters,
      conditions: [...localFilters.conditions, newCondition],
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="border rounded-lg bg-background shadow-sm my-4"
    >
      {/* Database header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-sm">{database.title}</span>
          <Badge variant="outline" className="text-xs">
            {databaseQuery.data?.rows?.length ?? 0} rows
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* View selector tabs */}
          <Tabs value={activeViewType} onValueChange={(val) => handleViewTypeChange(val as DatabaseViewType)}>
            <TabsList className="h-8">
              <TabsTrigger value="table" className="h-7 px-2">
                <LayoutTable className="h-3.5 w-3.5 mr-1" />
                Table
              </TabsTrigger>
              <TabsTrigger value="board" className="h-7 px-2">
                <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                Board
              </TabsTrigger>
              <TabsTrigger value="list" className="h-7 px-2">
                <List className="h-3.5 w-3.5 mr-1" />
                List
              </TabsTrigger>
              <TabsTrigger value="gallery" className="h-7 px-2">
                <ImageIcon className="h-3.5 w-3.5 mr-1" />
                Gallery
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filter button */}
          <Popover open={showFilterBuilder} onOpenChange={setShowFilterBuilder}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Filter className="h-3.5 w-3.5 mr-1" />
                Filter
                {localFilters.conditions.length > 0 && (
                  <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs">
                    {localFilters.conditions.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] max-h-[400px] overflow-y-auto p-4" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Filters</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => { setLocalFilters(createEmptyFilterGroup()); setShowFilterBuilder(false); }}
                  >
                    Clear all
                  </Button>
                </div>
                <FilterBuilder
                  columns={columns}
                  value={localFilters}
                  onChange={setLocalFilters}
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* Sort button */}
          <Popover open={showSortBuilder} onOpenChange={setShowSortBuilder}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                Sort
                {localSorts.length > 0 && (
                  <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs">
                    {localSorts.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-4" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Sort</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => { setLocalSorts([]); setShowSortBuilder(false); }}
                  >
                    Clear all
                  </Button>
                </div>
                <SortBuilder
                  columns={columns}
                  value={localSorts}
                  onChange={setLocalSorts}
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* Board group-by selector (only for board view) */}
          {activeViewType === 'board' && (
            <Select
              value={boardGroupBy}
              onValueChange={setBoardGroupBy}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Group by..." />
              </SelectTrigger>
              <SelectContent>
                {columns
                  .filter(c => c.type === 'select')
                  .map(col => (
                    <SelectItem key={col.column_id} value={col.column_id}>
                      {col.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}

          {/* Delete database button */}
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Database content area */}
      <div className="min-h-[200px]">
        {activeViewType === 'table' && (
          <DatabaseTableView
            database={database as NoteDatabaseInfo & { rows: DatabaseRowInfo[] }}
            databaseId={databaseId}
            viewId={activeViewId}
            filters={localFilters.conditions.length > 0 ? localFilters : undefined}
            sorts={localSorts}
            onSortChange={handleSortChange}
            onFilterChange={handleFilterColumn}
          />
        )}

        {activeViewType === 'board' && (
          <DatabaseBoardView
            database={database as NoteDatabaseInfo & { rows: DatabaseRowInfo[] }}
            databaseId={databaseId}
            viewId={activeViewId}
            filters={localFilters.conditions.length > 0 ? localFilters : undefined}
            sorts={localSorts}
            groupByColumnId={boardGroupBy}
          />
        )}

        {activeViewType === 'list' && (
          <DatabaseListView
            database={database as NoteDatabaseInfo & { rows: DatabaseRowInfo[] }}
            databaseId={databaseId}
            viewId={activeViewId}
            filters={localFilters.conditions.length > 0 ? localFilters : undefined}
            sorts={localSorts}
          />
        )}

        {activeViewType === 'gallery' && (
          <DatabaseGalleryView
            database={database as NoteDatabaseInfo & { rows: DatabaseRowInfo[] }}
            databaseId={databaseId}
            viewId={activeViewId}
            filters={localFilters.conditions.length > 0 ? localFilters : undefined}
            sorts={localSorts}
            config={{ galleryCoverColumnId: undefined }}
          />
        )}
      </div>
    </motion.div>
  );
}
