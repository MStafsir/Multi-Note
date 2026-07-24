// ============================================================
// MODUL 32.1: Database List View — Compact list view with row cards
// Shows rows in a vertical list format, each row rendered as a card
// ============================================================

'use client';

import { useState, useCallback } from 'react';
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
  useDeleteRow,
} from '@/hooks/use-database';
import type {
  ColumnSchema,
  DatabaseRowInfo,
  NoteDatabaseInfo,
  FilterGroup,
  SortDefinition,
} from '@/types';

interface DatabaseListViewProps {
  database: NoteDatabaseInfo & { rows?: DatabaseRowInfo[]; views?: never };
  databaseId: string;
  viewId?: string;
  filters?: FilterGroup;
  sorts?: SortDefinition[];
}

function ListRowCard({
  row,
  columns,
  onOpenDetail,
  onDelete,
}: {
  row: Record<string, unknown>;
  columns: ColumnSchema[];
  onOpenDetail: (rowId: string) => void;
  onDelete: (rowId: string) => void;
}) {
  // Show primary columns: first text, then select/status, then a few more
  const primaryCol = columns.find(c => c.type === 'text') ?? columns[0];
  const secondaryCols = columns.filter(c =>
    c.column_id !== primaryCol.column_id &&
    c.type !== 'formula' &&
    c.type !== 'rollup' &&
    c.type !== 'created_time' &&
    c.type !== 'created_by'
  ).slice(0, 3);

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-border/50 bg-background group"
      onClick={() => onOpenDetail(row.id as string)}
    >
      <CardContent className="p-3 flex items-center justify-between">
        {/* Left: title + properties */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="font-medium text-sm truncate">
            {row[primaryCol.column_id] !== null && row[primaryCol.column_id] !== undefined
              ? String(row[primaryCol.column_id])
              : 'Untitled'}
          </div>
          <div className="flex flex-wrap gap-1">
            {secondaryCols.map(col => {
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
                    <div className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: selected.colorHex }} />
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
                <Badge key={col.column_id} variant="outline" className="text-xs truncate max-w-[100px]">
                  {String(value).slice(0, 20)}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onOpenDetail(row.id as string); }}
            aria-label="View row details"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(row.id as string); }}
            aria-label="Delete row"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function DatabaseListView({
  database,
  databaseId,
  viewId,
  filters,
  sorts,
}: DatabaseListViewProps) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const columns = database.schema;
  const rowsQuery = useDatabaseRows(databaseId, { viewId, filters, sorts });
  const createRowMutation = useCreateRow();
  const deleteRowMutation = useDeleteRow();

  const rows = rowsQuery.data?.rows ?? [];

  const handleOpenDetail = useCallback((rowId: string) => {
    setSelectedRowId(rowId);
    setShowDetailPanel(true);
  }, []);

  const handleDeleteRow = useCallback((rowId: string) => {
    deleteRowMutation.mutate({ databaseId, rowId });
  }, [databaseId, deleteRowMutation]);

  return (
    <div className="flex flex-col h-full">
      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {rows.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              No rows yet. Click + to add a row.
            </div>
          )}
          {rows.map(row => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ListRowCard
                row={row as Record<string, unknown>}
                columns={columns}
                onOpenDetail={handleOpenDetail}
                onDelete={handleDeleteRow}
              />
            </motion.div>
          ))}
        </div>
      </ScrollArea>

      {/* Add row button */}
      <div className="p-2 border-t bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-8 text-sm"
          onClick={() => createRowMutation.mutate({ databaseId })}
        >
          <Plus className="h-4 w-4 mr-1" />
          New row
        </Button>
      </div>

      {/* Row detail panel */}
      <RowDetailPanel
        row={rows.find(r => r.id === selectedRowId) ?? null}
        columns={columns}
        databaseId={databaseId}
        open={showDetailPanel}
        onClose={() => setShowDetailPanel(false)}
      />
    </div>
  );
}
