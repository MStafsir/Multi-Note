// ============================================================
// MODUL 22: Zustand Store — Ephemeral Undo Stack
// Per-session only, expires on reload (NOT persisted to DB)
// ============================================================

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface UndoAction {
  id: string;
  type: 'rename' | 'move' | 'delete' | 'create' | 'favorite_toggle';
  description: string;
  timestamp: number;
  undoData: Record<string, unknown>; // data needed to reverse the action
}

interface UndoState {
  stack: UndoAction[];
  maxSize: number;
  pushAction: (action: Omit<UndoAction, 'id' | 'timestamp'>) => void;
  popAction: () => UndoAction | undefined;
  peekAction: () => UndoAction | undefined;
  clear: () => void;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  stack: [],
  maxSize: 10,

  pushAction: (action) => {
    const stack = get().stack;
    const newAction: UndoAction = {
      ...action,
      id: uuidv4(),
      timestamp: Date.now(),
    };

    // Trim stack if it exceeds maxSize
    const newStack = [newAction, ...stack].slice(0, get().maxSize);
    set({ stack: newStack });
  },

  popAction: () => {
    const stack = get().stack;
    if (stack.length === 0) return undefined;

    const [first, ...rest] = stack;
    set({ stack: rest });
    return first;
  },

  peekAction: () => {
    const stack = get().stack;
    return stack.length > 0 ? stack[0] : undefined;
  },

  clear: () => set({ stack: [] }),
}));
