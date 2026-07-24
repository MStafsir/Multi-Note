'use client';

// ============================================================
// CalculatorWidget — Floating panel (Modul 11)
// Three tab-switchable modes: Basic, Scientific, Unit Conversion
// CRITICAL: NEVER uses eval() — always uses mathjs via store
// ============================================================

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Delete,
  ArrowLeft,
  Calculator,
  History,
  ChevronDown,
  Copy,
  Bookmark,
} from 'lucide-react';
import { toast } from 'sonner';
import { evaluate } from 'mathjs';
import { useCalculatorStore } from '@/store/calculator';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { CalcMode } from '@/types';

// --- Unit Conversion Definitions ---
// Uses mathjs unit support for conversions
const UNIT_CATEGORIES = {
  length: {
    label: 'Length',
    units: ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'],
  },
  weight: {
    label: 'Weight',
    units: ['mg', 'g', 'kg', 'lb', 'oz', 'ton'],
  },
  temperature: {
    label: 'Temperature',
    units: ['degC', 'degF', 'degR'], // mathjs temperature units
  },
  time: {
    label: 'Time',
    units: ['ms', 's', 'min', 'h', 'day', 'week', 'year'],
  },
};

type UnitCategory = keyof typeof UNIT_CATEGORIES;

// --- Basic Calculator Buttons ---
const BASIC_BUTTONS: { label: string; value: string; type: 'num' | 'op' | 'action' }[] = [
  { label: 'C', value: 'clear', type: 'action' },
  { label: '⌫', value: 'backspace', type: 'action' },
  { label: '(', value: '(', type: 'op' },
  { label: ')', value: ')', type: 'op' },
  { label: '7', value: '7', type: 'num' },
  { label: '8', value: '8', type: 'num' },
  { label: '9', value: '9', type: 'num' },
  { label: '÷', value: '/', type: 'op' },
  { label: '4', value: '4', type: 'num' },
  { label: '5', value: '5', type: 'num' },
  { label: '6', value: '6', type: 'num' },
  { label: '×', value: '*', type: 'op' },
  { label: '1', value: '1', type: 'num' },
  { label: '2', value: '2', type: 'num' },
  { label: '3', value: '3', type: 'num' },
  { label: '−', value: '-', type: 'op' },
  { label: '0', value: '0', type: 'num' },
  { label: '.', value: '.', type: 'num' },
  { label: '%', value: '%', type: 'op' },
  { label: '=', value: '=', type: 'action' },
];

// --- Scientific Calculator Buttons ---
const SCIENTIFIC_BUTTONS: { label: string; value: string; type: 'func' | 'const' | 'op' }[] = [
  { label: 'sin', value: 'sin(', type: 'func' },
  { label: 'cos', value: 'cos(', type: 'func' },
  { label: 'tan', value: 'tan(', type: 'func' },
  { label: 'log', value: 'log(', type: 'func' },
  { label: 'ln', value: 'log(', type: 'func' }, // mathjs log() is natural log by default
  { label: '√', value: 'sqrt(', type: 'func' },
  { label: 'x^y', value: '^', type: 'op' },
  { label: '!', value: '!', type: 'op' },
  { label: 'π', value: 'pi', type: 'const' },
  { label: 'e', value: 'e', type: 'const' },
  { label: 'ans', value: 'ans', type: 'const' }, // previous result
];

export function CalculatorWidget() {
  const {
    isOpen,
    mode,
    expression,
    result,
    error,
    history,
    toggleOpen,
    setMode,
    setExpression,
    calculate,
    appendToExpression,
    clearExpression,
    backspace,
    clearHistory,
    applyHistoryItem,
    insertToNote,
  } = useCalculatorStore();

  const { user } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [unitCategory, setUnitCategory] = useState<UnitCategory>('length');
  const [fromUnit, setFromUnit] = useState('m');
  const [toUnit, setToUnit] = useState('km');
  const [unitInput, setUnitInput] = useState('');
  const [unitResult, setUnitResult] = useState<string | null>(null);
  const [unitError, setUnitError] = useState<string | null>(null);

  // Focus input when widget opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle basic/scientific button press
  const handleButtonPress = useCallback(
    (value: string, type: string) => {
      if (value === 'clear') {
        clearExpression();
        return;
      }
      if (value === 'backspace') {
        backspace();
        return;
      }
      if (value === '=') {
        calculate();
        return;
      }
      if (value === 'ans' && result) {
        appendToExpression(result);
        return;
      }
      appendToExpression(value);
    },
    [calculate, clearExpression, backspace, appendToExpression, result]
  );

  // Handle unit category change — resets units to defaults for new category
  const handleCategoryChange = useCallback(
    (category: UnitCategory) => {
      const units = UNIT_CATEGORIES[category].units;
      setUnitCategory(category);
      setFromUnit(units[0]);
      setToUnit(units[1]);
      setUnitInput('');
      setUnitResult(null);
      setUnitError(null);
    },
    []
  );

  // Handle Enter key in expression input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        calculate();
      }
    },
    [calculate]
  );

  // Unit conversion using mathjs
  const performUnitConversion = useCallback(() => {
    if (!unitInput.trim()) {
      setUnitResult(null);
      setUnitError(null);
      return;
    }

    try {
      // Build mathjs unit conversion expression: e.g., "5 m to km"
      // CRITICAL: Uses mathjs.evaluate() — NEVER eval()
      const expr = `${unitInput} ${fromUnit} to ${toUnit}`;
      const evaluated = evaluate(expr); // mathjs evaluate
      const resultStr = String(evaluated);
      setUnitResult(resultStr);
      setUnitError(null);

      // Add to history via store
      useCalculatorStore.setState((state) => ({
        history: [
          {
            expression: `${unitInput} ${fromUnit} → ${toUnit}`,
            result: resultStr,
            mode: 'unit' as CalcMode,
            createdAt: new Date().toISOString(),
          },
          ...state.history,
        ].slice(0, 50),
      }));
    } catch {
      setUnitResult(null);
      setUnitError('Invalid conversion');
    }
  }, [unitInput, fromUnit, toUnit]);

  // Copy result to clipboard
  const copyResult = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(result);
      toast.success('Result copied to clipboard');
    }
  }, [result]);

  // Save to permanent history (DB)
  const saveToPermanentHistory = useCallback(async () => {
    if (!result || !user) return;

    try {
      const res = await fetch('/api/calculator/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expression,
          result,
          mode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Saved to permanent history');
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save to permanent history');
    }
  }, [result, expression, mode, user]);

  // Handle mode change
  const handleModeChange = useCallback(
    (newMode: string) => {
      setMode(newMode as CalcMode);
    },
    [setMode]
  );

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-4 right-4 z-50 w-[360px] max-h-[80vh] shadow-xl"
    >
      <Card className="flex flex-col overflow-hidden border border-border bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-orange-500" />
            <span className="font-semibold text-sm">Calculator</span>
          </div>
          <div className="flex items-center gap-1">
            {result && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyResult} aria-label="Copy result">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveToPermanentHistory} aria-label="Save to history">
                  <Bookmark className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={insertToNote} aria-label="Insert to note">
                  <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleOpen} aria-label="Close calculator">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={mode} onValueChange={handleModeChange} className="flex-1 flex flex-col">
          <div className="px-3 pt-2">
            <TabsList className="w-full h-8">
              <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
              <TabsTrigger value="scientific" className="text-xs">Scientific</TabsTrigger>
              <TabsTrigger value="unit" className="text-xs">Unit</TabsTrigger>
            </TabsList>
          </div>

          {/* Expression + Result Display (shared for basic & scientific) */}
          <TabsContent value="basic" className="flex-1 flex flex-col px-3 pt-2 gap-2">
            <div className="space-y-1">
              <Input
                ref={inputRef}
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type expression..."
                className="text-sm h-9"
                aria-label="Calculator expression input"
              />
              <div className="flex items-center justify-between min-h-[28px] px-1">
                {error && <span className="text-xs text-destructive">{error}</span>}
                {result && !error && (
                  <span className="text-sm font-medium text-emerald-600 truncate max-w-full">
                    = {result}
                  </span>
                )}
                {!result && !error && (
                  <span className="text-xs text-muted-foreground">Enter an expression</span>
                )}
              </div>
            </div>

            {/* Basic button grid */}
            <div className="grid grid-cols-4 gap-1.5">
              {BASIC_BUTTONS.map((btn) => (
                <Button
                  key={btn.label}
                  variant={btn.type === 'action' ? 'secondary' : btn.type === 'op' ? 'outline' : 'ghost'}
                  size="sm"
                  className={`h-9 text-sm font-medium ${
                    btn.type === 'action' ? 'bg-muted' : ''
                  } ${
                    btn.value === '=' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''
                  }`}
                  onClick={() => handleButtonPress(btn.value, btn.type)}
                  aria-label={btn.label}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="scientific" className="flex-1 flex flex-col px-3 pt-2 gap-2">
            <div className="space-y-1">
              <Input
                ref={inputRef}
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type expression (e.g., sin(pi/2))..."
                className="text-sm h-9"
                aria-label="Scientific calculator expression input"
              />
              <div className="flex items-center justify-between min-h-[28px] px-1">
                {error && <span className="text-xs text-destructive">{error}</span>}
                {result && !error && (
                  <span className="text-sm font-medium text-emerald-600 truncate max-w-full">
                    = {result}
                  </span>
                )}
                {!result && !error && (
                  <span className="text-xs text-muted-foreground">Enter an expression</span>
                )}
              </div>
            </div>

            {/* Scientific buttons */}
            <div className="grid grid-cols-4 gap-1.5 mb-1">
              {SCIENTIFIC_BUTTONS.map((btn) => (
                <Button
                  key={btn.label}
                  variant={btn.type === 'const' ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8 text-xs font-medium"
                  onClick={() => handleButtonPress(btn.value, btn.type)}
                  aria-label={btn.label}
                >
                  {btn.label}
                </Button>
              ))}
            </div>

            {/* Also include basic buttons below */}
            <div className="grid grid-cols-4 gap-1.5">
              {BASIC_BUTTONS.map((btn) => (
                <Button
                  key={`sci-${btn.label}`}
                  variant={btn.type === 'action' ? 'secondary' : btn.type === 'op' ? 'outline' : 'ghost'}
                  size="sm"
                  className={`h-9 text-sm font-medium ${
                    btn.type === 'action' ? 'bg-muted' : ''
                  } ${
                    btn.value === '=' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''
                  }`}
                  onClick={() => handleButtonPress(btn.value, btn.type)}
                  aria-label={btn.label}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="unit" className="flex-1 flex flex-col px-3 pt-2 gap-3">
            {/* Category selector */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <Select value={unitCategory} onValueChange={(v) => handleCategoryChange(v as UnitCategory)}>
                <SelectTrigger className="w-full h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(UNIT_CATEGORIES).map(([key, cat]) => (
                    <SelectItem key={key} value={key}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* From/To unit selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">From</label>
                <Select value={fromUnit} onValueChange={setFromUnit}>
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_CATEGORIES[unitCategory].units.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">To</label>
                <Select value={toUnit} onValueChange={setToUnit}>
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_CATEGORIES[unitCategory].units.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Value input */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Value</label>
              <Input
                value={unitInput}
                onChange={(e) => setUnitInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') performUnitConversion();
                }}
                placeholder="Enter value..."
                className="text-sm h-9"
                aria-label="Unit conversion value"
              />
            </div>

            {/* Convert button */}
            <Button onClick={performUnitConversion} className="w-full bg-emerald-600 text-white hover:bg-emerald-700 h-9">
              Convert
            </Button>

            {/* Result display */}
            <div className="min-h-[28px] px-1">
              {unitError && <span className="text-xs text-destructive">{unitError}</span>}
              {unitResult && !unitError && (
                <span className="text-sm font-medium text-emerald-600">
                  {unitInput} {fromUnit} = {unitResult}
                </span>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* History section */}
        <Separator />
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">History</span>
              <span className="text-xs text-muted-foreground">({history.length})</span>
            </div>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={clearHistory}>
                Clear
              </Button>
            )}
          </div>

          <ScrollArea className="max-h-[120px]">
            {history.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">No calculations yet</span>
            ) : (
              <div className="space-y-1">
                {history.map((item, index) => (
                  <button
                    key={`hist-${index}-${item.createdAt}`}
                    className="flex items-center gap-2 w-full px-2 py-1 rounded text-xs hover:bg-accent/50 transition-colors text-left"
                    onClick={() => applyHistoryItem(index)}
                    aria-label={`Use calculation: ${item.expression}`}
                  >
                    <span className="text-muted-foreground truncate flex-1 min-w-0">
                      {item.expression}
                    </span>
                    <span className="text-emerald-600 font-medium shrink-0">
                      = {item.result}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Footer hint */}
        <div className="px-3 py-1.5 border-t bg-muted/20">
          <span className="text-xs text-muted-foreground">
            Ctrl+K to toggle · Ctrl+S to save note
          </span>
        </div>
      </Card>
    </motion.div>
  );
}
