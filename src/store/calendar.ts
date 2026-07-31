// ============================================================
// Zustand Store — Calendar Panel State (Modul 79/80)
// Manages calendar panel visibility, month navigation, and
// scheduled entry CRUD operations.
// ============================================================

import { create } from 'zustand';

// --- Calendar Entry Type ---
export interface CalendarEntry {
  id: string;
  name: string;
  scheduledDate: string;
  type: 'note';
  content?: { contentJson: string } | null;
}

// --- Store State Interface ---
interface CalendarState {
  isOpen: boolean; // panel visibility
  currentMonth: number; // 0-11 (JS Date month)
  currentYear: number; // e.g. 2026
  selectedDate: string | null; // 'YYYY-MM-DD' format, null = no date selected
  entries: Record<string, CalendarEntry[]>; // key = 'YYYY-MM-DD', value = entries
  isLoading: boolean;

  // Actions
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  navigateMonth: (delta: number) => void; // delta = -1 for prev, +1 for next
  setSelectedDate: (date: string | null) => void;
  fetchEntries: (startDate: string, endDate: string) => Promise<void>;
  createEntry: (data: {
    name: string;
    scheduledDate: string;
    parentId?: string;
  }) => Promise<void>;
  deleteEntry: (nodeId: string) => Promise<void>;
}

// --- localStorage key for panel open state (Modul 79.5) ---
const CALENDAR_PANEL_OPEN_KEY = 'calendar-panel-open';

/**
 * Read persisted isOpen from localStorage.
 * Returns false if not found or if running on server.
 */
function readPersistedIsOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(CALENDAR_PANEL_OPEN_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

/**
 * Persist isOpen to localStorage.
 */
function persistIsOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CALENDAR_PANEL_OPEN_KEY, String(open));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Get the current month/year for client-side initialization (Modul 80.2).
 * Returns safe defaults (0, 1970) on server-side.
 */
function getInitialDate(): { month: number; year: number } {
  if (typeof window === 'undefined') {
    return { month: 0, year: 1970 }; // SSR-safe defaults
  }
  const now = new Date();
  return { month: now.getMonth(), year: now.getFullYear() };
}

/**
 * Compute the start and end date strings for a given month/year.
 * Returns { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }.
 */
function getMonthDateRange(
  year: number,
  month: number
): { startDate: string; endDate: string } {
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}

export const useCalendarStore = create<CalendarState>((set, get) => {
  const initialDate = getInitialDate();
  const persistedOpen = readPersistedIsOpen();

  return {
    // --- State ---
    isOpen: persistedOpen,
    currentMonth: initialDate.month,
    currentYear: initialDate.year,
    selectedDate: null,
    entries: {},
    isLoading: false,

    // --- Actions ---

    toggleOpen: () => {
      set((state) => {
        const newOpen = !state.isOpen;
        persistIsOpen(newOpen);
        return { isOpen: newOpen };
      });
    },

    setOpen: (open) => {
      persistIsOpen(open);
      set({ isOpen: open });
    },

    navigateMonth: (delta) => {
      const { currentMonth, currentYear, fetchEntries } = get();
      let newMonth = currentMonth + delta;
      let newYear = currentYear;

      // Handle month overflow/underflow
      if (newMonth > 11) {
        newMonth = 0;
        newYear += 1;
      } else if (newMonth < 0) {
        newMonth = 11;
        newYear -= 1;
      }

      set({ currentMonth: newMonth, currentYear: newYear });

      // Automatically fetch entries for the new month (Modul 79.3)
      const { startDate, endDate } = getMonthDateRange(newYear, newMonth);
      fetchEntries(startDate, endDate);
    },

    setSelectedDate: (date) => set({ selectedDate: date }),

    fetchEntries: async (startDate, endDate) => {
      set({ isLoading: true });
      try {
        const res = await fetch(
          `/api/calendar?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
        );
        if (!res.ok) {
          throw new Error(`Failed to fetch calendar entries: ${res.status}`);
        }
        const result = await res.json();

        // API returns { success: true, data: { entries: { 'YYYY-MM-DD': [...] } } }
        const grouped: Record<string, CalendarEntry[]> = result?.data?.entries ?? {};

        // Merge with existing entries — only update keys in the fetched range
        set((state) => {
          const newEntries = { ...state.entries };

          // Remove keys in the fetched date range
          const start = new Date(startDate);
          const end = new Date(endDate);
          for (const key of Object.keys(newEntries)) {
            const keyDate = new Date(key);
            if (keyDate >= start && keyDate <= end) {
              delete newEntries[key];
            }
          }

          // Add freshly fetched entries
          for (const [key, value] of Object.entries(grouped)) {
            newEntries[key] = value;
          }

          return { entries: newEntries, isLoading: false };
        });
      } catch {
        set({ isLoading: false });
      }
    },

    createEntry: async (data) => {
      try {
        const res = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            scheduledDate: data.scheduledDate,
            parentId: data.parentId,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to create calendar entry: ${res.status}`);
        }

        const result = await res.json();
        const entry: CalendarEntry = result?.data ?? result;

        // Optimistically add to local entries — use the date key from the response
        set((state) => {
          // Format scheduledDate as YYYY-MM-DD for the key
          const dateObj = new Date(entry.scheduledDate);
          const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
          const existing = state.entries[key] ?? [];
          return {
            entries: {
              ...state.entries,
              [key]: [...existing, entry],
            },
          };
        });
      } catch {
        // Silently fail — UI can refetch if needed
      }
    },

    deleteEntry: async (nodeId) => {
      try {
        const res = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          throw new Error(`Failed to delete entry: ${res.status}`);
        }

        // Remove from local entries
        set((state) => {
          const newEntries: Record<string, CalendarEntry[]> = {};
          for (const [key, value] of Object.entries(state.entries)) {
            const filtered = value.filter((e) => e.id !== nodeId);
            if (filtered.length > 0) {
              newEntries[key] = filtered;
            }
            // If all entries for that date are removed, the key is omitted
          }
          return { entries: newEntries };
        });
      } catch {
        // Silently fail — UI can refetch if needed
      }
    },
  };
});
