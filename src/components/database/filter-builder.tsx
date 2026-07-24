// ============================================================
// MODUL 32.2: Filter Builder — Per-column conditions with AND/OR nesting
// Builds a FilterGroup tree that is serialized to JSON for server-side evaluation
// ============================================================

'use client';

import { useState, useCallback } from 'react';
import { Plus, X, GitBranch, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { ColumnSchema, FilterGroup, FilterCondition, FilterOperator, PropertyType } from '@/types';

interface FilterBuilderProps {
  columns: ColumnSchema[];
  value: FilterGroup;
  onChange: (filter: FilterGroup) => void;
}

// Operators available per property type
const OPERATORS_BY_TYPE: Record<string, FilterOperator[]> = {
  text: ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'],
  number: ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'],
  select: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
  multi_select: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  date: ['equals', 'before', 'after', 'on_or_before', 'on_or_after', 'is_empty', 'is_not_empty'],
  checkbox: ['equals'],
  url: ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'],
  person: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
  relation: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
  formula: ['equals', 'not_equals', 'greater_than', 'less_than'],
  rollup: ['equals', 'not_equals', 'greater_than', 'less_than'],
  created_time: ['before', 'after', 'on_or_before', 'on_or_after'],
  created_by: ['equals', 'not_equals'],
};

// Needs value input for these operators
const VALUE_OPERATORS: Set<string> = new Set([
  'equals', 'not_equals', 'contains', 'not_contains',
  'greater_than', 'less_than', 'before', 'after',
  'on_or_before', 'on_or_after',
]);

function FilterConditionRow({
  condition,
  columns,
  onChange,
  onRemove,
}: {
  condition: FilterCondition;
  columns: ColumnSchema[];
  onChange: (condition: FilterCondition) => void;
  onRemove: () => void;
}) {
  const column = columns.find(c => c.column_id === condition.columnId);
  const columnType = column?.type ?? 'text';
  const availableOperators = OPERATORS_BY_TYPE[columnType] ?? OPERATORS_BY_TYPE.text;
  const needsValue = VALUE_OPERATORS.has(condition.operator);

  // Get select options for this column
  const selectOptions = column?.config?.options ?? [];

  return (
    <div className="flex items-center gap-2 flex-wrap min-h-[44px]">
      {/* Column selector */}
      <Select
        value={condition.columnId}
        onValueChange={(val) => onChange({ ...condition, columnId: val, value: undefined })}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Column" />
        </SelectTrigger>
        <SelectContent>
          {columns.map(col => (
            <SelectItem key={col.column_id} value={col.column_id}>
              {col.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator selector */}
      <Select
        value={condition.operator}
        onValueChange={(val) => onChange({ ...condition, operator: val as FilterOperator, value: undefined })}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Operator" />
        </SelectTrigger>
        <SelectContent>
          {availableOperators.map(op => (
            <SelectItem key={op} value={op}>
              {op.replace('_', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      {needsValue && (
        columnType === 'select' || columnType === 'multi_select' ? (
          <Select
            value={condition.value as string ?? ''}
            onValueChange={(val) => onChange({ ...condition, value: val })}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Value" />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map(opt => (
                <SelectItem key={opt.id} value={opt.id}>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: opt.colorHex }}
                    />
                    {opt.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : columnType === 'checkbox' ? (
          <Select
            value={condition.value ? 'true' : 'false'}
            onValueChange={(val) => onChange({ ...condition, value: val === 'true' })}
          >
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            className="w-[140px] h-9"
            value={condition.value as string ?? ''}
            onChange={(e) => {
              const val = columnType === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
              onChange({ ...condition, value: val });
            }}
            placeholder="Value"
            type={columnType === 'number' ? 'number' : 'text'}
          />
        )
      )}

      {/* Remove button */}
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function FilterGroupNode({
  group,
  columns,
  onChange,
  onRemove,
  depth = 0,
}: {
  group: FilterGroup;
  columns: ColumnSchema[];
  onChange: (group: FilterGroup) => void;
  onRemove?: () => void;
  depth?: number;
}) {
  const addCondition = useCallback(() => {
    const newCondition: FilterCondition = {
      columnId: columns[0]?.column_id ?? '',
      operator: 'equals',
      value: undefined,
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  }, [group, columns, onChange]);

  const addSubGroup = useCallback(() => {
    const newGroup: FilterGroup = {
      type: 'and',
      conditions: [],
    };
    onChange({
      ...group,
      groups: [...(group.groups ?? []), newGroup],
    });
  }, [group, onChange]);

  const updateCondition = useCallback((index: number, condition: FilterCondition) => {
    const newConditions = [...group.conditions];
    newConditions[index] = condition;
    onChange({ ...group, conditions: newConditions });
  }, [group, onChange]);

  const removeCondition = useCallback((index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    onChange({ ...group, conditions: newConditions });
  }, [group, onChange]);

  const updateSubGroup = useCallback((index: number, subGroup: FilterGroup) => {
    const newGroups = [...(group.groups ?? [])];
    newGroups[index] = subGroup;
    onChange({ ...group, groups: newGroups });
  }, [group, onChange]);

  const removeSubGroup = useCallback((index: number) => {
    const newGroups = (group.groups ?? []).filter((_, i) => i !== index);
    onChange({ ...group, groups: newGroups });
  }, [group, onChange]);

  const toggleType = useCallback(() => {
    onChange({ ...group, type: group.type === 'and' ? 'or' : 'and' });
  }, [group, onChange]);

  const bgClass = depth === 0 ? 'bg-background' : depth === 1 ? 'bg-muted/30' : 'bg-muted/50';
  const borderClass = depth > 0 ? 'border-l-2 border-muted-foreground/20 pl-3' : '';

  return (
    <div className={`${bgClass} ${borderClass} rounded-md p-3 space-y-2`}>
      {/* Group header: AND/OR toggle + add buttons */}
      <div className="flex items-center gap-2">
        <Badge
          variant={group.type === 'and' ? 'default' : 'secondary'}
          className="cursor-pointer select-none text-xs font-semibold uppercase"
          onClick={toggleType}
          role="button"
          aria-label={`Toggle filter logic: currently ${group.type}`}
        >
          {group.type === 'and' ? 'AND' : 'OR'}
        </Badge>

        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addCondition}>
          <Plus className="h-3 w-3 mr-1" />
          Condition
        </Button>

        {depth < 2 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addSubGroup}>
            <GitBranch className="h-3 w-3 mr-1" />
            Group
          </Button>
        )}

        {onRemove && depth > 0 && (
          <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={onRemove}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Conditions */}
      {group.conditions.map((condition, index) => (
        <FilterConditionRow
          key={`cond-${index}`}
          condition={condition}
          columns={columns}
          onChange={(c) => updateCondition(index, c)}
          onRemove={() => removeCondition(index)}
        />
      ))}

      {/* Sub-groups */}
      {(group.groups ?? []).map((subGroup, index) => (
        <FilterGroupNode
          key={`group-${index}`}
          group={subGroup}
          columns={columns}
          onChange={(g) => updateSubGroup(index, g)}
          onRemove={() => removeSubGroup(index)}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function FilterBuilder({ columns, value, onChange }: FilterBuilderProps) {
  return (
    <div className="space-y-2">
      <FilterGroupNode
        group={value}
        columns={columns}
        onChange={onChange}
        depth={0}
      />
    </div>
  );
}

// Helper: Create an empty filter group
export function createEmptyFilterGroup(): FilterGroup {
  return {
    type: 'and',
    conditions: [],
    groups: [],
  };
}
