// ============================================================
// MODUL 32.1: Database Gallery View — Cards with cover images from relation columns
// Shows rows as visual cards in a grid layout
// ============================================================

'use client';

import { useState, useCallback } from 'react';
import { Plus, Trash2, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  DatabaseViewConfig,
} from '@/types';

interface DatabaseGalleryViewProps {
  database: NoteDatabaseInfo & { rows?: DatabaseRowInfo[]; views?: never };
  databaseId: string;
  viewId?: string;
  filters?: FilterGroup;
  sorts?: SortDefinition[];
  config?: DatabaseViewConfig;
}

function GalleryCard({
  row,
  columns,
  coverColumnId,
  onOpenDetail,
  onDelete,
}: {
  row: Record<string, unknown>;
  columns: ColumnSchema[];
  coverColumnId?: string;
  onOpenDetail: (rowId: string) => void;
  onDelete: (rowId: string) => void;
}) {
  // Title: first text column
  const titleCol = columns.find(c => c.type === 'text') ?? columns[0];
  const title = row[titleCol.column_id] !== null && row[titleCol.column_id] !== undefined
    ? String(row[titleCol.column_id])
    : 'Untitled';

  // Cover: use the cover column value as cover image URL if it's a url type
  const coverUrl = coverColumnId ? row[coverColumnId] as string : null;

  // Description columns: show first 2-3 non-title, non-cover columns
  const descColumns = columns.filter(c =>
    c.column_id !== titleCol.column_id &&
    c.column_id !== coverColumnId &&
    c.type !== 'formula' &&
    c.type !== 'rollup' &&
    c.type !== 'created_time' &&
    c.type !== 'created_by'
  ).slice(0, 3);

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-border/50 bg-background group overflow-hidden"
      onClick={() => onOpenDetail(row.id as string)}
    >
      {/* Cover image */}
      {coverUrl && (
        <div className="h-[120px] bg-muted/50 overflow-hidden">
          <img
            src={coverUrl}
            alt={title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      {!coverUrl && (
        <div className="h-[40px] bg-gradient-to-r from-primary/5 to-primary/10" />
      )}

      <CardHeader className="p-3 pb-1">
        <div className="font-medium text-sm truncate">{title}</div>
      </CardHeader>

      <CardContent className="p-3 pt-0 space-y-1">
        {/* Properties */}
        <div className="flex flex-wrap gap-1">
          {descColumns.map(col => {
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

            return (
              <Badge key={col.column_id} variant="outline" className="text-xs truncate max-w-[100px]">
                {String(value).slice(0, 15)}
              </Badge>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); onOpenDetail(row.id as string); }}
            aria-label="View details"
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
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

export function DatabaseGalleryView({
  database,
  databaseId,
  viewId,
  filters,
  sorts,
  config,
}: DatabaseGalleryViewProps) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const columns = database.schema;
  const rowsQuery = useDatabaseRows(databaseId, { viewId, filters, sorts });
  const createRowMutation = useCreateRow();
  const deleteRowMutation = useDeleteRow();

  const rows = rowsQuery.data?.rows ?? [];

  // Cover column from config
  const coverColumnId = config?.galleryCoverColumnId;

  const handleOpenDetail = useCallback((rowId: string) => {
    setSelectedRowId(rowId);
    setShowDetailPanel(true);
  }, []);

  const handleDeleteRow = useCallback((rowId: string) => {
    deleteRowMutation.mutate({ databaseId, rowId });
  }, [databaseId, deleteRowMutation]);

  return (
    <div className="flex flex-col h-full">
      {/* Gallery grid */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {rows.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              No rows yet. Click + to add a row.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {rows.map(row => (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
              >
                <GalleryCard
                  row={row as Record<string, unknown>}
                  columns={columns}
                  coverColumnId={coverColumnId}
                  onOpenDetail={handleOpenDetail}
                  onDelete={handleDeleteRow}
                />
              </motion.div>
            ))}
          </div>
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
