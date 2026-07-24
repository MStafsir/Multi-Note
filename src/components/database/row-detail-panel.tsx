// ============================================================
// MODUL 32.6: Row Detail Panel — Side-peek panel showing all row properties
// Slide-in panel from the right, shows all columns with editable fields
// ============================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useUpdateRow } from '@/hooks/use-database';
import type { ColumnSchema, CellValue, PropertyType, SelectOption, DatabaseRowInfo } from '@/types';

interface RowDetailPanelProps {
  row: DatabaseRowInfo | null;
  columns: ColumnSchema[];
  databaseId: string;
  open: boolean;
  onClose: () => void;
}

// Debounce utility for autosave
function useDebounce<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = useCallback(
    (...args: unknown[]) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

// Editable field per property type
function PropertyField({
  column,
  value,
  onChange,
}: {
  column: ColumnSchema;
  value: CellValue;
  onChange: (value: CellValue) => void;
}) {
  const type = column.type;
  const config = column.config;

  // Computed columns are not editable
  if (type === 'formula' || type === 'rollup' || type === 'created_time' || type === 'created_by') {
    return (
      <div className="text-sm text-muted-foreground px-3 py-2 rounded-md bg-muted/30">
        {value !== null && value !== undefined
          ? type === 'created_time'
            ? new Date(value as string).toLocaleString()
            : String(value)
          : '—'}
      </div>
    );
  }

  switch (type) {
    case 'text':
      return (
        <Input
          className="h-9"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter text..."
        />
      );

    case 'number':
      return (
        <Input
          className="h-9"
          type="number"
          value={value as number ?? ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder="0"
        />
      );

    case 'select': {
      const options = config?.options ?? [];
      return (
        <Select
          value={(value as string) ?? ''}
          onValueChange={(val) => onChange(val)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {options.map(opt => (
              <SelectItem key={opt.id} value={opt.id}>
                <div className="flex items-center gap-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: opt.colorHex }}
                  />
                  {opt.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              className="text-xs cursor-pointer"
              style={{ backgroundColor: opt.colorHex + '20', borderColor: opt.colorHex }}
              onClick={() => onChange(selectedIds.filter(id => id !== opt.id))}
            >
              <div className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: opt.colorHex }} />
              {opt.name}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
          <Select
            value=""
            onValueChange={(val) => {
              if (!selectedIds.includes(val)) {
                onChange([...selectedIds, val]);
              }
            }}
          >
            <SelectTrigger className="h-7 w-[80px] text-xs">
              <SelectValue placeholder="Add..." />
            </SelectTrigger>
            <SelectContent>
              {options
                .filter(opt => !selectedIds.includes(opt.id))
                .map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opt.colorHex }} />
                      {opt.name}
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    case 'date':
      return (
        <Input
          className="h-9"
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'checkbox':
      return (
        <div className="flex items-center gap-2 px-3">
          <Checkbox
            checked={value as boolean ?? false}
            onCheckedChange={(checked) => onChange(Boolean(checked))}
          />
          <span className="text-sm">{(value as boolean) ? 'Yes' : 'No'}</span>
        </div>
      );

    case 'url':
      return (
        <Input
          className="h-9"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          type="url"
        />
      );

    case 'person':
      return (
        <Input
          className="h-9"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="User ID..."
          disabled // Person is typically auto-populated
        />
      );

    case 'relation':
      return (
        <Input
          className="h-9"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Related row ID..."
          disabled // Relation is typically auto-populated
        />
      );

    default:
      return (
        <Input
          className="h-9"
          value={value !== null && value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export function RowDetailPanel({
  row,
  columns,
  databaseId,
  open,
  onClose,
}: RowDetailPanelProps) {
  const updateRowMutation = useUpdateRow();

  // Sync local state with row data using a key-based reset approach
  // Instead of setState in effect, we use the row.id to trigger re-render with fresh state
  const initialCellData = row?.cellData ?? {};
  const [localCellData, setLocalCellData] = useState<Record<string, CellValue>>(initialCellData);

  // Reset local state when row changes — use a derived approach (not useEffect setState)
  const currentRowId = row?.id;
  const [lastRowId, setLastRowId] = useState(currentRowId);
  if (currentRowId !== lastRowId) {
    setLastRowId(currentRowId ?? null);
    setLocalCellData(row?.cellData ?? {});
  }

  // Debounced autosave (500ms — same as Modul 9.5)
  const debouncedSave = useDebounce(
    (cellData: Record<string, CellValue>) => {
      if (row) {
        updateRowMutation.mutate({
          databaseId,
          rowId: row.id,
          cellData,
        });
      }
    },
    500
  );

  const handleFieldChange = (columnId: string, value: CellValue) => {
    const newData = { ...localCellData, [columnId]: value };
    setLocalCellData(newData);
    debouncedSave(newData);
  };

  if (!row) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed inset-y-0 right-0 w-[400px] max-w-[90vw] bg-background border-l shadow-xl z-50 flex flex-col"
          role="dialog"
          aria-label="Row detail panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-sm">Row Details</h3>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Properties */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-80px)]">
            {columns.map(column => (
              <div key={column.column_id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {column.name}
                  </span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {column.type}
                  </Badge>
                </div>
                <PropertyField
                  column={column}
                  value={localCellData[column.column_id] ?? null}
                  onChange={(value) => handleFieldChange(column.column_id, value)}
                />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-muted/30">
            <div className="text-xs text-muted-foreground">
              Created: {new Date(row.createdAt).toLocaleString()}
              <br />
              Updated: {new Date(row.updatedAt).toLocaleString()}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
