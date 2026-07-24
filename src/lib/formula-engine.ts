// ============================================================
// MODUL 31.5: Formula Engine — Reuses Calculator mathjs (Modul 11.2)
// Principle: anti-eval() — same security stance as Calculator module
// ============================================================

import { evaluate } from 'mathjs';

// Formula reference-cell function: prop("ColumnName") → resolves cell value from row data
// This is the ONLY way to reference other cells — no arbitrary JS execution

export interface FormulaContext {
  rowData: Record<string, unknown>;
  columnSchema: Array<{ column_id: string; name: string; type: string }>;
}

// Build a safe variable scope from row data for mathjs evaluate
// Maps column names to their numeric/text values for formula resolution
function buildFormulaScope(context: FormulaContext): Record<string, unknown> {
  const scope: Record<string, unknown> = {};

  for (const col of context.columnSchema) {
    const rawValue = context.rowData[col.column_id];
    // Only numeric values go into scope for mathjs
    // prop() function resolves by column name (not column_id)
    if (col.type === 'number' || col.type === 'formula' || col.type === 'rollup') {
      scope[col.name] = typeof rawValue === 'number' ? rawValue : 0;
    } else if (col.type === 'checkbox') {
      scope[col.name] = typeof rawValue === 'boolean' ? (rawValue ? 1 : 0) : 0;
    } else {
      // For text/date/select — store as string, not usable in math but available via prop()
      scope[col.name] = rawValue ?? '';
    }
  }

  return scope;
}

// Custom prop() function — resolves column value by name
// Injected into mathjs scope so formula expressions can use prop("ColumnName")
function createPropFunction(context: FormulaContext): (columnName: string) => unknown {
  const nameToIdMap = new Map<string, string>();
  for (const col of context.columnSchema) {
    nameToIdMap.set(col.name, col.column_id);
  }

  return (columnName: string): unknown => {
    const columnId = nameToIdMap.get(columnName);
    if (!columnId) return null;
    return context.rowData[columnId] ?? null;
  };
}

// Evaluate a formula expression safely using mathjs
// Reuses same anti-eval() principle as Calculator (Modul 11.2)
// — mathjs evaluate is sandboxed, no arbitrary JS execution
// — only prop() and column names are available in scope
export function evaluateFormula(
  expression: string,
  context: FormulaContext
): unknown {
  if (!expression || expression.trim() === '') return null;

  try {
    const scope = buildFormulaScope(context);
    // Inject prop() function into scope
    scope.prop = createPropFunction(context);

    // Use mathjs evaluate — same engine as Calculator (Modul 11.2)
    // This is NOT eval() — mathjs has its own parser that doesn't execute arbitrary JS
    const result = evaluate(expression, scope);

    // Sanitize result — only return numbers, strings, booleans, null
    if (typeof result === 'number' || typeof result === 'string' || typeof result === 'boolean') {
      return result;
    }
    if (result === null || result === undefined) return null;

    // If result is a mathjs object (e.g., BigNumber), convert to primitive
    if (typeof result?.toNumber === 'function') return result.toNumber();
    if (typeof result?.toString === 'function') return result.toString();

    return null;
  } catch (error) {
    // Formula evaluation error — return null (not crash)
    console.warn('[formula-engine] Formula evaluation failed:', expression, error);
    return null;
  }
}

// ============================================================
// MODUL 31.7: Dynamic Zod validation for cell data
// Generate Zod schema on-the-fly from column schema definition
// ============================================================

import { z } from 'zod';

// Map property type to Zod validator
function propertyTypeToZodValidator(type: string, config?: Record<string, unknown>): z.ZodType {
  switch (type) {
    case 'text':
      return z.string().max(5000);
    case 'number':
      return z.number().finite();
    case 'select':
      // Validate that value is one of the defined options
      const options = (config?.options as Array<{ id: string }>) ?? [];
      if (options.length > 0) {
        return z.enum(options.map(o => o.id) as [string, ...string[]]).nullable();
      }
      return z.string().nullable();
    case 'multi_select':
      const multiOptions = (config?.options as Array<{ id: string }>) ?? [];
      if (multiOptions.length > 0) {
        return z.array(z.enum(multiOptions.map(o => o.id) as [string, ...string[]])).max(20);
      }
      return z.array(z.string()).max(20);
    case 'date':
      return z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/, 'Invalid date format').nullable();
    case 'checkbox':
      return z.boolean();
    case 'url':
      return z.string().url().max(2000).nullable();
    case 'person':
      return z.string().cuid().nullable(); // FK to auth.users (User.id)
    case 'relation':
      return z.string().cuid().nullable(); // FK to another note_databases.id
    case 'formula':
      return z.union([z.number(), z.string(), z.boolean(), z.null()]); // computed, not user-input
    case 'rollup':
      return z.union([z.number(), z.string(), z.null()]); // computed aggregation
    case 'created_time':
      return z.string(); // auto-set, not user-input
    case 'created_by':
      return z.string(); // auto-set, not user-input
    default:
      return z.unknown(); // fallback for unknown types
  }
}

// Generate dynamic Zod schema from column definitions
// Used for validating cell_data on insert/update row
export function generateCellDataSchema(
  columns: Array<{ column_id: string; name: string; type: string; config?: Record<string, unknown> }>
): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {};

  for (const col of columns) {
    // formula, rollup, created_time, created_by are computed/auto — skip validation for user input
    // but include them in schema for completeness (they'll be computed server-side)
    if (col.type === 'formula' || col.type === 'rollup' || col.type === 'created_time' || col.type === 'created_by') {
      shape[col.column_id] = z.unknown().optional();
      continue;
    }
    shape[col.column_id] = propertyTypeToZodValidator(col.type, col.config).optional();
  }

  return z.object(shape);
}

// Validate cell_data against generated schema
// Returns { valid: boolean, errors?: ZodError }
export function validateCellData(
  cellData: Record<string, unknown>,
  columns: Array<{ column_id: string; name: string; type: string; config?: Record<string, unknown> }>
): { valid: boolean; errors?: z.ZodError } {
  const schema = generateCellDataSchema(columns);
  const result = schema.safeParse(cellData);

  if (result.success) {
    return { valid: true };
  }
  return { valid: false, errors: result.error };
}
