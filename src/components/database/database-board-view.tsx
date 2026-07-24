// ============================================================
// MODUL 32.5: Database Board View — Kanban board grouped by select column
// Drag-drop between groups using @dnd-kit/core
// ============================================================

'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { Plus, Trash2, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RowDetailPanel } from './row-detail-panel';
import {
  useDatabaseRows,
  useCreateRow,
  useUpdateRow,
  useDeleteRow,
} from '@/hooks/use-database';
import type {
  ColumnSchema,
  CellValue,
  DatabaseRowInfo,
  NoteDatabaseInfo,
  SelectOption,
  FilterGroup,
  SortDefinition,
} from '@/types';

interface DatabaseBoardViewProps {
  database: NoteDatabaseInfo & { rows?: DatabaseRowInfo[]; views?: never };
  databaseId: string;
  viewId?: string;
  filters?: FilterGroup;
  sorts?: SortDefinition[];
  groupByColumnId: string; // select column to group by
}

// Card component for each row in a kanban group
function BoardCard({
  row,
  columns,
  groupColumn,
  onOpenDetail,
  onDelete,
}: {
  row: Record<string, unknown>;
  columns: ColumnSchema[];
  groupColumn: ColumnSchema;
  onOpenDetail: (rowId: string) => void;
  onDelete: (rowId: string) => void;
}) {
  // Show a subset of columns as card properties (excluding the groupBy column)
  const displayColumns = columns.filter(col =>
    col.column_id !== groupColumn.column_id &&
    col.type !== 'formula' &&
    col.type !== 'rollup' &&
    col.type !== 'created_time' &&
    col.type !== 'created_by'
  ).slice(0, 4); // Show max 4 properties per card

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-border/50 bg-background"
      onClick={() => onOpenDetail(row.id as string)}
    >
      <CardContent className="p-3 space-y-1.5">
        {/* Title: show first text column value */}
        {displayColumns.length > 0 && (() => {
          const titleCol = displayColumns.find(c => c.type === 'text') ?? displayColumns[0];
          const titleValue = row[titleCol.column_id];
          return (
            <div className="font-medium text-sm truncate">
              {titleValue !== null && titleValue !== undefined ? String(titleValue) : 'Untitled'}
            </div>
          );
        })()}

        {/* Other properties as compact badges */}
        <div className="flex flex-wrap gap-1">
          {displayColumns.filter(col => col.type !== 'text').map(col => {
            const value = row[col.column_id];
            if (value === null || value === undefined) return null;

            if (col.type === 'select') {
              const options = col.config?.options ?? [];
              const selected = options.find(opt => opt.id === value);
              if (!selected) return null;
              return (
                <Badge
                  key={col.column_id}
                  variant="secondary"
                  className="text-xs"
                  style={{ backgroundColor: selected.colorHex + '20' }}
                >
                  {selected.name}
                </Badge>
              );
            }

            if (col.type === 'checkbox') {
              return (
                <Badge key={col.column_id} variant="outline" className="text-xs">
                  {value ? '✓' : '✗'}
                </Badge>
              );
            }

            return (
              <Badge key={col.column_id} variant="outline" className="text-xs">
                {String(value).slice(0, 20)}
              </Badge>
            );
          })}
        </div>

        {/* Card footer actions */}
        <div className="flex items-center justify-end gap-1 pt-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 hover:opacity-100 group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onDelete(row.id as string); }}
            aria-label="Delete row"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function DatabaseBoardView({
  database,
  databaseId,
  viewId,
  filters,
  sorts,
  groupByColumnId,
}: DatabaseBoardViewProps) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);

  const columns = database.schema;
  const rowsQuery = useDatabaseRows(databaseId, { viewId, filters, sorts });
  const createRowMutation = useCreateRow();
  const updateRowMutation = useUpdateRow();
  const deleteRowMutation = useDeleteRow();

  const rows = rowsQuery.data?.rows ?? [];

  // DnD sensors — must be called before any conditional return (React hooks rule)
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const sensors = useSensors(pointerSensor);

  // Drag handlers — must be called before any conditional return
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id);
  }, []);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // No intermediate action needed
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const rowId = String(active.id);
    const targetGroupId = String(over.id);

    // Find the row being dragged
    const draggedRow = rows.find(r => r.id === rowId);
    if (!draggedRow) return;

    // Update the row's select column value to the target group
    updateRowMutation.mutate({
      databaseId,
      rowId,
      cellData: { [groupByColumnId]: targetGroupId === 'unassigned' ? null : targetGroupId },
    });
  }, [rows, databaseId, groupByColumnId, updateRowMutation]);

  const handleOpenDetail = useCallback((rowId: string) => {
    setSelectedRowId(rowId);
    setShowDetailPanel(true);
  }, []);

  const handleDeleteRow = useCallback((rowId: string) => {
    deleteRowMutation.mutate({ databaseId, rowId });
  }, [databaseId, deleteRowMutation]);

  const handleCreateRowInGroup = useCallback((groupId: string | null) => {
    createRowMutation.mutate({
      databaseId,
      cellData: groupId ? { [groupByColumnId]: groupId } : {},
    });
  }, [databaseId, groupByColumnId, createRowMutation]);

  // Find the groupBy column — computed after hooks to avoid conditional hook calls
  const groupColumn = columns.find(c => c.column_id === groupByColumnId);

  // Build groups from select options
  const selectOptions = groupColumn?.config?.options ?? [];
  const groups = selectOptions.map(opt => ({
    id: opt.id,
    name: opt.name,
    colorHex: opt.colorHex,
    rows: rows.filter(row => (row as Record<string, unknown>)[groupByColumnId] === opt.id),
  }));

  // Unassigned group (rows where the select value is null or not matching any option)
  const unassignedRows = rows.filter(row => {
    const value = (row as Record<string, unknown>)[groupByColumnId];
    return value === null || value === undefined || !selectOptions.some(opt => opt.id === value);
  });

  // If no groupBy column found, show a placeholder message
  if (!groupColumn) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Select a column to group by for board view
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 min-h-[400px]">
          {/* Select option groups */}
          {groups.map(group => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col min-w-[280px] max-w-[320px] w-[280px]"
              id={group.id}
            >
              {/* Group header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: group.colorHex }}
                  />
                  <span className="font-medium text-sm">{group.name}</span>
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">
                    {group.rows.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleCreateRowInGroup(group.id)}
                  aria-label="Add row to group"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Cards */}
              <ScrollArea className="flex-1 max-h-[500px]">
                <div className="space-y-2 pr-2" id={`${group.id}-cards`}>
                  {group.rows.map(row => (
                    <div key={row.id} className="group">
                      <BoardCard
                        row={row as Record<string, unknown>}
                        columns={columns}
                        groupColumn={groupColumn}
                        onOpenDetail={handleOpenDetail}
                        onDelete={handleDeleteRow}
                      />
                    </div>
                  ))}
                  {group.rows.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No items
                    </div>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          ))}

          {/* Unassigned group */}
          {unassignedRows.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col min-w-[280px] max-w-[320px] w-[280px]"
              id="unassigned"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="font-medium text-sm text-muted-foreground">No group</span>
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  {unassignedRows.length}
                </Badge>
              </div>
              <ScrollArea className="flex-1 max-h-[500px]">
                <div className="space-y-2 pr-2">
                  {unassignedRows.map(row => (
                    <div key={row.id} className="group">
                      <BoardCard
                        row={row as Record<string, unknown>}
                        columns={columns}
                        groupColumn={groupColumn}
                        onOpenDetail={handleOpenDetail}
                        onDelete={handleDeleteRow}
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDragId ? (
          <Card className="shadow-lg border-primary/20 bg-background/90">
            <CardContent className="p-3">
              <span className="text-sm font-medium">Moving...</span>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>

      {/* Row detail panel */}
      <RowDetailPanel
        row={rows.find(r => r.id === selectedRowId) ?? null}
        columns={columns}
        databaseId={databaseId}
        open={showDetailPanel}
        onClose={() => setShowDetailPanel(false)}
      />
    </DndContext>
  );
}
