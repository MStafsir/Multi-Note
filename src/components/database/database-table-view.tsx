// ============================================================
// MODUL 32.4: Database Table View — Inline cell editing, autosave debounce, 
// sortable columns, filterable, column header menu
// ============================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ColumnHeaderMenu } from './column-header-menu';
import { RowDetailPanel } from './row-detail-panel';
import {
  useDatabaseRows,
  useCreateRow,
  useUpdateRow,
  useDeleteRow,
  useUpdateDatabase,
} from '@/hooks/use-database';
import type {
  ColumnSchema,
  CellValue,
  DatabaseRowInfo,
  NoteDatabaseInfo,
  PropertyType,
  FilterGroup,
  SortDefinition,
  SelectOption,
} from '@/types';

interface DatabaseTableViewProps {
  database: NoteDatabaseInfo & { rows?: DatabaseRowInfo[]; views?: never };
  databaseId: string;
  viewId?: string;
  filters?: FilterGroup;
  sorts?: SortDefinition[];
  onSortChange?: (sorts: SortDefinition[]) => void;
  onFilterChange?: (columnId: string) => void;
}

// Cell renderer per property type
function CellRenderer({
  column,
  value,
  isEditing,
  onStartEdit,
  onEditChange,
  onCommitEdit,
}: {
  column: ColumnSchema;
  value: CellValue;
  isEditing: boolean;
  onStartEdit: () => void;
  onEditChange: (value: CellValue) => void;
  onCommitEdit: () => void;
}) {
  const type = column.type;
  const config = column.config;

  // Computed columns: read-only display
  if (type === 'formula' || type === 'rollup' || type === 'created_time' || type === 'created_by') {
    const displayValue = value !== null && value !== undefined
      ? type === 'created_time' ? new Date(value as string).toLocaleDateString()
      : type === 'checkbox' ? (value ? '✓' : '✗')
      : String(value)
      : '—';

    return (
      <div
        className="px-2 py-1 text-sm text-muted-foreground truncate"
        title={displayValue}
      >
        {displayValue}
      </div>
    );
  }

  // Editing mode
  if (isEditing) {
    switch (type) {
      case 'text':
        return (
          <Input
            className="h-7 text-sm px-2 py-0"
            value={(value as string) ?? ''}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') onCommitEdit(); }}
            autoFocus
          />
        );

      case 'number':
        return (
          <Input
            className="h-7 text-sm px-2 py-0 w-[80px]"
            type="number"
            value={value as number ?? ''}
            onChange={(e) => onEditChange(parseFloat(e.target.value) || 0)}
            onBlur={onCommitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') onCommitEdit(); }}
            autoFocus
          />
        );

      case 'select': {
        const options = config?.options ?? [];
        return (
          <Select
            value={(value as string) ?? ''}
            onValueChange={(val) => { onEditChange(val); onCommitEdit(); }}
          >
            <SelectTrigger className="h-7 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt.id} value={opt.id}>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: opt.colorHex }} />
                    {opt.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      case 'checkbox':
        return (
          <div className="flex items-center justify-center px-2">
            <Checkbox
              checked={value as boolean ?? false}
              onCheckedChange={(checked) => { onEditChange(Boolean(checked)); onCommitEdit(); }}
            />
          </div>
        );

      case 'date':
        return (
          <Input
            className="h-7 text-sm px-2 py-0"
            type="date"
            value={(value as string) ?? ''}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onCommitEdit}
            autoFocus
          />
        );

      case 'url':
        return (
          <Input
            className="h-7 text-sm px-2 py-0"
            value={(value as string) ?? ''}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommitEdit(); }}
            autoFocus
            placeholder="https://..."
          />
        );

      default:
        return (
          <Input
            className="h-7 text-sm px-2 py-0"
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onCommitEdit}
            autoFocus
          />
        );
    }
  }

  // Display mode (click to edit)
  const renderDisplay = () => {
    switch (type) {
      case 'checkbox':
        return (
          <div className="flex items-center justify-center">
            <Checkbox checked={value as boolean ?? false} disabled className="pointer-events-none" />
          </div>
        );

      case 'select': {
        const options = config?.options ?? [];
        const selected = options.find(opt => opt.id === value);
        if (!selected) return <span className="text-muted-foreground">—</span>;
        return (
          <Badge
            variant="secondary"
            className="text-xs font-normal"
            style={{ backgroundColor: selected.colorHex + '20', borderColor: selected.colorHex }}
          >
            <div className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: selected.colorHex }} />
            {selected.name}
          </Badge>
        );
      }

      case 'multi_select': {
        const options = config?.options ?? [];
        const selectedIds = (value as string[]) ?? [];
        const selectedOptions = options.filter(opt => selectedIds.includes(opt.id));
        return (
          <div className="flex flex-wrap gap-1">
            {selectedOptions.map(opt => (
              <Badge
                key={opt.id}
                variant="secondary"
                className="text-xs font-normal"
                style={{ backgroundColor: opt.colorHex + '20' }}
              >
                <div className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: opt.colorHex }} />
                {opt.name}
              </Badge>
            ))}
            {selectedOptions.length === 0 && <span className="text-muted-foreground">—</span>}
          </div>
        );
      }

      default:
        return (
          <span className="text-sm truncate block max-w-[200px]" title={value !== null && value !== undefined ? String(value) : ''}>
            {value !== null && value !== undefined ? String(value) : ''}
          </span>
        );
    }
  };

  return (
    <div
      className="px-2 py-1 cursor-pointer hover:bg-accent/30 rounded transition-colors min-h-[28px] flex items-center"
      onClick={onStartEdit}
      role="button"
      tabIndex={0}
      aria-label={`Edit ${column.name}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStartEdit(); }}
    >
      {renderDisplay()}
    </div>
  );
}

export function DatabaseTableView({
  database,
  databaseId,
  viewId,
  filters,
  sorts,
  onSortChange,
  onFilterChange,
}: DatabaseTableViewProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);
  const [editingValue, setEditingValue] = useState<CellValue>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const columns = database.schema;
  const rowsQuery = useDatabaseRows(databaseId, { viewId, filters, sorts });
  const createRowMutation = useCreateRow();
  const updateRowMutation = useUpdateRow();
  const deleteRowMutation = useDeleteRow();
  const updateDatabaseMutation = useUpdateDatabase();

  // Debounce timer for autosave
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rows = rowsQuery.data?.rows ?? [];

  // Inline cell editing with autosave debounce (500ms)
  const startEditing = useCallback((rowId: string, columnId: string, currentValue: CellValue) => {
    setEditingCell({ rowId, columnId });
    setEditingValue(currentValue);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;

    // Clear debounce timer — we're committing now
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Only save if value changed
    const currentRow = rows.find(r => r.id === editingCell.rowId);
    if (currentRow) {
      const currentValue = (currentRow as Record<string, unknown>)[editingCell.columnId];
      if (editingValue !== currentValue) {
        updateRowMutation.mutate({
          databaseId,
          rowId: editingCell.rowId,
          cellData: { [editingCell.columnId]: editingValue },
        });
      }
    }

    setEditingCell(null);
    setEditingValue(null);
  }, [editingCell, editingValue, rows, databaseId, updateRowMutation]);

  // Column header actions
  const handleColumnRename = useCallback((columnId: string, newName: string) => {
    const newSchema = columns.map(col =>
      col.column_id === columnId ? { ...col, name: newName } : col
    );
    updateDatabaseMutation.mutate({ id: databaseId, schema: newSchema });
  }, [columns, databaseId, updateDatabaseMutation]);

  const handleColumnChangeType = useCallback((columnId: string, newType: PropertyType) => {
    const newSchema = columns.map(col =>
      col.column_id === columnId ? { ...col, type: newType, config: undefined } : col
    );
    updateDatabaseMutation.mutate({ id: databaseId, schema: newSchema });
  }, [columns, databaseId, updateDatabaseMutation]);

  const handleColumnDelete = useCallback((columnId: string) => {
    const newSchema = columns.filter(col => col.column_id !== columnId);
    updateDatabaseMutation.mutate({ id: databaseId, schema: newSchema });
  }, [columns, databaseId, updateDatabaseMutation]);

  const handleColumnSort = useCallback((columnId: string, direction: 'asc' | 'desc') => {
    const newSorts: SortDefinition[] = [{ columnId, direction }];
    onSortChange?.(newSorts);
  }, [onSortChange]);

  const handleColumnFilter = useCallback((columnId: string) => {
    onFilterChange?.(columnId);
  }, [onFilterChange]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              {/* Row actions column */}
              <TableHead className="w-[40px] sticky left-0 bg-background z-10" />
              {columns.map(column => (
                <TableHead key={column.column_id} className="min-w-[120px]">
                  <ColumnHeaderMenu
                    column={column}
                    allColumns={columns}
                    onRename={handleColumnRename}
                    onChangeType={handleColumnChangeType}
                    onDelete={handleColumnDelete}
                    onSort={handleColumnSort}
                    onFilter={handleColumnFilter}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">
                  No rows yet. Click + to add a row.
                </TableCell>
              </TableRow>
            )}
            {rows.map(row => (
              <TableRow
                key={row.id}
                className="group hover:bg-accent/10 cursor-pointer"
                onClick={() => {
                  setSelectedRowId(row.id);
                  setShowDetailPanel(true);
                }}
              >
                {/* Row actions */}
                <TableCell className="w-[40px] sticky left-0 bg-background z-10">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); setShowDetailPanel(true); setSelectedRowId(row.id); }}
                      aria-label="View row details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteRowMutation.mutate({ databaseId, rowId: row.id }); }}
                      aria-label="Delete row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
                {columns.map(column => {
                  const rowValue = (row as Record<string, unknown>)[column.column_id] as CellValue;
                  const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.column_id;

                  return (
                    <TableCell key={column.column_id} className="py-1 px-0">
                      <CellRenderer
                        column={column}
                        value={isEditing ? editingValue : rowValue}
                        isEditing={isEditing}
                        onStartEdit={() => startEditing(row.id, column.column_id, rowValue)}
                        onEditChange={(val) => {
                          setEditingValue(val);
                          // Debounced autosave 500ms
                          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                          debounceTimerRef.current = setTimeout(() => {
                            updateRowMutation.mutate({
                              databaseId,
                              rowId: row.id,
                              cellData: { [column.column_id]: val },
                            });
                          }, 500);
                        }}
                        onCommitEdit={commitEdit}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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

      {/* Pagination */}
      {rowsQuery.data && rowsQuery.data.totalPages > 1 && (
        <div className="flex items-center justify-between p-2 border-t">
          <span className="text-xs text-muted-foreground">
            {rowsQuery.data.total} rows · Page {rowsQuery.data.page}/{rowsQuery.data.totalPages}
          </span>
        </div>
      )}

      {/* Row detail side-peek panel */}
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
