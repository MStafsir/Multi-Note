// ============================================================
// MODUL 32: Column Header Menu — Dropdown for column operations
// Rename, Change type, Delete column, Sort ascending/descending, Filter
// ============================================================

'use client';

import { useState } from 'react';
import {
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Filter,
  SortAsc,
  SortDesc,
  Type,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ColumnSchema, PropertyType, SortDefinition } from '@/types';

interface ColumnHeaderMenuProps {
  column: ColumnSchema;
  allColumns: ColumnSchema[];
  onRename: (columnId: string, newName: string) => void;
  onChangeType: (columnId: string, newType: PropertyType) => void;
  onDelete: (columnId: string) => void;
  onSort: (columnId: string, direction: 'asc' | 'desc') => void;
  onFilter: (columnId: string) => void;
}

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'url', label: 'URL' },
  { value: 'person', label: 'Person' },
  { value: 'relation', label: 'Relation' },
  { value: 'formula', label: 'Formula' },
  { value: 'rollup', label: 'Rollup' },
  { value: 'created_time', label: 'Created Time' },
  { value: 'created_by', label: 'Created By' },
];

export function ColumnHeaderMenu({
  column,
  allColumns,
  onRename,
  onChangeType,
  onDelete,
  onSort,
  onFilter,
}: ColumnHeaderMenuProps) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(column.name);

  const handleRename = () => {
    if (newName.trim() && newName !== column.name) {
      onRename(column.column_id, newName.trim());
    }
    setRenaming(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 font-medium hover:bg-accent/50"
        >
          {column.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {/* Rename */}
        {renaming ? (
          <div className="p-2 flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setRenaming(false);
              }}
              autoFocus
              className="h-7 text-sm"
            />
            <Button size="sm" className="h-7" onClick={handleRename}>
              Save
            </Button>
          </div>
        ) : (
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
        )}

        {/* Change type */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Type className="h-4 w-4 mr-2" />
            Change type
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-[180px]">
            {PROPERTY_TYPES.map(pt => (
              <DropdownMenuItem
                key={pt.value}
                onClick={() => onChangeType(column.column_id, pt.value)}
                className={column.type === pt.value ? 'bg-accent' : ''}
              >
                {pt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Sort */}
        <DropdownMenuItem onClick={() => onSort(column.column_id, 'asc')}>
          <ArrowUp className="h-4 w-4 mr-2" />
          Sort ascending
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSort(column.column_id, 'desc')}>
          <ArrowDown className="h-4 w-4 mr-2" />
          Sort descending
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Filter */}
        <DropdownMenuItem onClick={() => onFilter(column.column_id)}>
          <Filter className="h-4 w-4 mr-2" />
          Filter by this column
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Delete */}
        <DropdownMenuItem
          onClick={() => onDelete(column.column_id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete column
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
