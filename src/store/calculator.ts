// ============================================================
// Zustand Store — Calculator Widget State (Modul 11)
// CRITICAL: NEVER uses eval() — always uses mathjs.evaluate()
// ============================================================

import { create } from 'zustand';
import { evaluate } from 'mathjs';
import type { CalcMode, CalcHistoryItem } from '@/types';

interface CalculatorStoreState {
  isOpen: boolean;
  mode: CalcMode;
  expression: string;
  result: string | null;
  error: string | null;
  history: CalcHistoryItem[];
  insertCallback: ((result: string) => void) | null;

  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setMode: (mode: CalcMode) => void;
  setExpression: (expr: string) => void;
  calculate: () => void;
  appendToExpression: (value: string) => void;
  clearExpression: () => void;
  backspace: () => void;
  clearHistory: () => void;
  removeFromHistory: (index: number) => void;
  applyHistoryItem: (index: number) => void;
  setInsertCallback: (callback: ((result: string) => void) | null) => void;
  insertToNote: () => void;
}

export const useCalculatorStore = create<CalculatorStoreState>((set, get) => ({
  isOpen: false,
  mode: 'basic',
  expression: '',
  result: null,
  error: null,
  history: [],
  insertCallback: null,

  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open) => set({ isOpen: open }),

  setMode: (mode) => set({ mode, expression: '', result: null, error: null }),

  setExpression: (expr) => set({ expression: expr, error: null }),

  calculate: () => {
    const { expression, mode } = get();
    if (!expression.trim()) {
      set({ result: null, error: null });
      return;
    }

    try {
      // CRITICAL: Uses mathjs.evaluate() — NEVER eval()
      // mathjs safely parses expressions and rejects malicious input
      // like require('fs'), process.exit(), etc.
      const evaluated = evaluate(expression);
      const resultStr =
        typeof evaluated === 'object' && evaluated !== null
          ? JSON.stringify(evaluated)
          : String(evaluated);

      set({ result: resultStr, error: null });

      // Add to session history
      const historyItem: CalcHistoryItem = {
        expression,
        result: resultStr,
        mode,
        createdAt: new Date().toISOString(),
      };

      set((state) => ({
        history: [historyItem, ...state.history].slice(0, 50), // Max 50 items in session
      }));
    } catch {
      // mathjs throws errors for invalid/malicious expressions
      // e.g., require('fs'), process.exit(), etc. → "Invalid expression"
      set({ result: null, error: 'Invalid expression' });
    }
  },

  appendToExpression: (value) =>
    set((state) => ({ expression: state.expression + value, error: null })),

  clearExpression: () => set({ expression: '', result: null, error: null }),

  backspace: () =>
    set((state) => ({
      expression: state.expression.slice(0, -1),
      error: null,
    })),

  clearHistory: () => set({ history: [] }),

  removeFromHistory: (index) =>
    set((state) => ({
      history: state.history.filter((_, i) => i !== index),
    })),

  applyHistoryItem: (index) => {
    const item = get().history[index];
    if (item) {
      set({ expression: item.expression, result: item.result, error: null });
    }
  },

  setInsertCallback: (callback) => set({ insertCallback: callback }),

  insertToNote: () => {
    const { result, insertCallback } = get();
    if (result && insertCallback) {
      insertCallback(result);
    }
  },
}));
