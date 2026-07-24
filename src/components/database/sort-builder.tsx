// ============================================================
// MODUL 32.3: Sort Builder — Multi-level sort UI
// Allows adding/removing multiple sort levels, persisted per-view
// ============================================================

'use client';

import { Plus, X, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ColumnSchema, SortDefinition } from '@/types';

interface SortBuilderProps {
  columns: ColumnSchema[];
  value: SortDefinition[];
  onChange: (sorts: SortDefinition[]) => void;
}

export function SortBuilder({ columns, value, onChange }: SortBuilderProps) {
  const addSort = () => {
    if (value.length >= 5) return; // max 5 sort levels
    const newSort: SortDefinition = {
      columnId: columns[0]?.column_id ?? '',
      direction: 'asc',
    };
    onChange([...value, newSort]);
  };

  const removeSort = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateSort = (index: number, sort: SortDefinition) => {
    const newSorts = [...value];
    newSorts[index] = sort;
    onChange(newSorts);
  };

  // Only show columns that are sortable (not formula/rollup computed on read, but still sortable)
  const sortableColumns = columns.filter(col =>
    ['text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url', 'person', 'relation', 'created_time', 'created_by'].includes(col.type)
  );

  return (
    <div className="space-y-2">
      {value.map((sort, index) => (
        <div key={`sort-${index}`} className="flex items-center gap-2 min-h-[44px]">
          {/* Level indicator */}
          <span className="text-xs text-muted-foreground font-medium w-16">
            Sort {index + 1}
          </span>

          {/* Column selector */}
          <Select
            value={sort.columnId}
            onValueChange={(val) => updateSort(index, { ...sort, columnId: val })}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Column" />
            </SelectTrigger>
            <SelectContent>
              {sortableColumns.map(col => (
                <SelectItem key={col.column_id} value={col.column_id}>
                  {col.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Direction selector */}
          <Select
            value={sort.direction}
            onValueChange={(val) => updateSort(index, { ...sort, direction: val as 'asc' | 'desc' })}
          >
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">
                <div className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" />
                  Ascending
                </div>
              </SelectItem>
              <SelectItem value="desc">
                <div className="flex items-center gap-1">
                  <ArrowDown className="h-3 w-3" />
                  Descending
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Remove button */}
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeSort(index)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Add sort button */}
      {value.length < 5 && (
        <Button variant="ghost" size="sm" className="h-9" onClick={addSort}>
          <Plus className="h-4 w-4 mr-1" />
          Add sort level
        </Button>
      )}
    </div>
  );
}
