'use client';

// ============================================================
// MODUL 79+80: Calendar Panel — Right-side docked panel
// All date logic is CLIENT-SIDE ONLY (Modul 80.2)
// ============================================================

import { useEffect, useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCalendarStore, CalendarEntry } from '@/store/calendar';
import { CalendarEntryEditor } from './calendar-entry-editor';

// --- Day names (Minggu–Sabtu) ---
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// --- Month names ---
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Format date as YYYY-MM-DD (local timezone, NOT UTC)
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD (client-side only, Modul 80.2)
 */
function getTodayStr(): string {
  return formatLocalDate(new Date());
}

/**
 * Compute calendar grid data for a given month/year.
 * Returns 6 rows × 7 cols of { date: Date, isCurrentMonth: boolean, dateStr: string }
 */
function getCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { date: Date; isCurrentMonth: boolean; dateStr: string }[] = [];

  // Leading days from previous month
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const date = new Date(year, month - 1, day);
    cells.push({ date, isCurrentMonth: false, dateStr: formatLocalDate(date) });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push({ date, isCurrentMonth: true, dateStr: formatLocalDate(date) });
  }

  // Trailing days from next month (fill to 42 cells = 6 rows × 7 cols)
  const remaining = 42 - cells.length;
  for (let day = 1; day <= remaining; day++) {
    const date = new Date(year, month + 1, day);
    cells.push({ date, isCurrentMonth: false, dateStr: formatLocalDate(date) });
  }

  return cells;
}

export function CalendarPanel() {
  const {
    isOpen,
    currentMonth,
    currentYear,
    selectedDate,
    entries,
    isLoading,
    toggleOpen,
    navigateMonth,
    setSelectedDate,
    fetchEntries,
    createEntry,
  } = useCalendarStore();

  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newEntryName, setNewEntryName] = useState('');

  // Client-side today (Modul 80.2 — MUST be computed client-side only)
  // Use lazy initializer to avoid setState in effect
  const [todayStr] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return getTodayStr();
  });

  // Fetch entries when month changes
  const fetchMonthEntries = useCallback(() => {
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    fetchEntries(startDate, endDate);
  }, [currentYear, currentMonth, fetchEntries]);

  useEffect(() => {
    if (isOpen) {
      fetchMonthEntries();
    }
  }, [isOpen, currentYear, currentMonth, fetchMonthEntries]);

  // Calendar grid
  const grid = getCalendarGrid(currentYear, currentMonth);
  const rows = [];
  for (let i = 0; i < grid.length; i += 7) {
    rows.push(grid.slice(i, i + 7));
  }

  // Get entries for selected date
  const selectedEntries = selectedDate ? (entries[selectedDate] ?? []) : [];

  // Handle create entry
  const handleCreateEntry = async () => {
    if (!selectedDate || !newEntryName.trim()) return;
    await createEntry({
      name: newEntryName.trim(),
      scheduledDate: selectedDate,
    });
    setNewEntryName('');
    setIsCreating(false);
    // Refetch to ensure sync
    fetchMonthEntries();
  };

  if (!isOpen) return null;

  return (
    <aside className="w-[340px] border-l border-border bg-background flex flex-col shrink-0 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Kalender</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleOpen}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {MONTH_NAMES[currentMonth]} {currentYear}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day Names Header */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1.5">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-7">
            {row.map((cell) => {
              const hasEntries = (entries[cell.dateStr]?.length ?? 0) > 0;
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDate;

              return (
                <button
                  key={cell.dateStr}
                  className={`
                    relative flex flex-col items-center justify-center py-1.5 text-xs
                    transition-colors cursor-pointer
                    ${!cell.isCurrentMonth ? 'text-muted-foreground/40' : 'text-foreground'}
                    ${isToday ? 'font-bold' : ''}
                    ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}
                  `}
                  onClick={() => setSelectedDate(cell.dateStr)}
                >
                  <span
                    className={`
                      inline-flex items-center justify-center w-6 h-6 rounded-full text-xs
                      ${isToday ? 'bg-primary text-primary-foreground' : ''}
                      ${isSelected && !isToday ? 'ring-1 ring-primary' : ''}
                    `}
                  >
                    {cell.date.getDate()}
                  </span>
                  {hasEntries && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected Date Entries */}
      {selectedDate && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="h-3 w-3" />
              Tambah
            </Button>
          </div>

          {/* Create new entry form */}
          {isCreating && (
            <div className="px-3 pb-2 flex gap-2">
              <input
                type="text"
                placeholder="Nama entry..."
                className="flex-1 text-xs border border-border rounded px-2 py-1 bg-background"
                value={newEntryName}
                onChange={(e) => setNewEntryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateEntry();
                  if (e.key === 'Escape') { setIsCreating(false); setNewEntryName(''); }
                }}
                autoFocus
              />
              <Button size="sm" className="h-6 text-xs" onClick={handleCreateEntry}>
                Simpan
              </Button>
            </div>
          )}

          <ScrollArea className="max-h-40">
            {isLoading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : selectedEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Tidak ada entry
              </p>
            ) : (
              <div className="px-3 pb-2 space-y-1">
                {selectedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-muted/50 cursor-pointer group"
                    onClick={() => setEditingEntry(entry)}
                  >
                    <span className="text-xs truncate flex-1">{entry.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        useCalendarStore.getState().deleteEntry(entry.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Entry Editor Modal */}
      {editingEntry && (
        <CalendarEntryEditor
          entry={editingEntry}
          onClose={() => {
            setEditingEntry(null);
            fetchMonthEntries();
          }}
        />
      )}
    </aside>
  );
}
