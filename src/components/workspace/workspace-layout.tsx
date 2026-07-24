'use client';

// ============================================================
// MODUL 12: Workspace Layout — Global search shortcut + search button in header
// Ctrl+Shift+F (or Cmd+Shift+F on Mac) focuses the search input
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, Calculator, Search, LogOut, User as UserIcon } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { NotificationBadge } from '@/components/notifications/notification-badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sidebar } from './sidebar';
import { ContentArea } from './content-area';
import { useAuthStore } from '@/store/auth';
import { useCalculatorStore } from '@/store/calculator';
import { useFileTreeStore } from '@/store/file-tree';
import { WorkspaceDndProvider } from '@/components/dnd/dnd-context';
import { CalculatorWidget } from '@/components/calculator/calculator-widget';
import { SearchDropdown } from '@/components/search/search-dropdown';
import { TrashView } from '@/components/trash/trash-view';

export function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Default closed on mobile
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);

  // Auto-open sidebar on desktop, auto-close on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
        setSidebarCollapsed(false);
      } else {
        setSidebarOpen(false);
      }
    };
    // Set initial state based on viewport
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { user } = useAuthStore();
  const { toggleOpen, isOpen } = useCalculatorStore();
  const { setCurrentFolder, flatNodes, activeView } = useFileTreeStore();

  // Detect mobile viewport
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const searchRef = useRef<HTMLDivElement>(null);

  // 12.6 — Global search shortcut: Ctrl+Shift+F (or Cmd+Shift+F on Mac)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Calculator shortcut (existing)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleOpen();
      }
      // Search shortcut (new)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setHeaderSearchOpen(true);
        setTimeout(() => {
          const input = searchRef.current?.querySelector('input');
          if (input) input.focus();
        }, 50);
      }
    },
    [toggleOpen]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Navigate to node from header search
  const handleHeaderSearchNavigate = useCallback((
    nodeId: string,
    nodeType: string,
    parentId: string | null
  ) => {
    setHeaderSearchOpen(false);
    if (nodeType === 'folder') {
      const folderNode = flatNodes.get(nodeId);
      if (folderNode) {
        setCurrentFolder(nodeId, []);
      }
    } else if (nodeType === 'note') {
      if (parentId) {
        setCurrentFolder(parentId, []);
      }
    } else {
      if (parentId) {
        setCurrentFolder(parentId, []);
      }
    }
  }, [flatNodes, setCurrentFolder]);

  return (
    <WorkspaceDndProvider>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col bg-background">
          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center h-14 px-4 gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  if (sidebarOpen) {
                    setSidebarCollapsed(!sidebarCollapsed);
                  } else {
                    setSidebarOpen(true);
                    setSidebarCollapsed(false);
                  }
                }}
                aria-label={sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
              >
                {!sidebarOpen ? (
                  <PanelLeftOpen className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </Button>

              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900">
                  <span className="text-xs font-bold">UW</span>
                </div>
                <span className="font-semibold text-sm truncate hidden sm:inline">Unified Workspace</span>
              </div>

              <div className="flex-1" />

              {/* 12.6 — Global search button in header */}
              <div className="flex items-center gap-2">
                {!headerSearchOpen ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setHeaderSearchOpen(true)}
                    aria-label="Search workspace"
                  >
                    <Search className="h-4 w-4" />
                    <span className="text-sm">Search</span>
                    <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                      ⌘⇧F
                    </kbd>
                  </Button>
                ) : (
                  <div ref={searchRef} className="w-64">
                    <SearchDropdown
                      onNavigateToNode={handleHeaderSearchNavigate}
                      className="w-64"
                    />
                  </div>
                )}

                {/* Mobile search button (always visible on small screens) */}
                {!headerSearchOpen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setHeaderSearchOpen(true)}
                    aria-label="Search workspace"
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* 20.3 — Notification badge + preferences */}
                <NotificationBadge />

                {/* Calculator toggle button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isOpen ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={toggleOpen}
                      aria-label="Toggle calculator (Ctrl+K)"
                    >
                      <Calculator className={`h-4 w-4 ${isOpen ? 'text-orange-500' : 'text-muted-foreground'}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Calculator (Ctrl+K)</p>
                  </TooltipContent>
                </Tooltip>

                {/* User menu dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 h-auto p-1 rounded-full">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-medium">
                        {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
                      </div>
                      <span className="hidden sm:inline text-sm text-muted-foreground">{user?.email}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-medium">{user?.name || 'User'}</span>
                        <span className="text-xs text-muted-foreground">{user?.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        useAuthStore.getState().logout();
                        signOut({ redirect: false });
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Main content: sidebar + workspace */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Mobile backdrop overlay — close sidebar when clicking backdrop */}
            {sidebarOpen && isMobile && (
              <div
                className="fixed inset-0 bg-black/40 z-20 md:hidden"
                onClick={() => setSidebarOpen(false)}
                role="button"
                tabIndex={-1}
                aria-label="Close sidebar"
              />
            )}

            {/* Sidebar — on mobile it overlays (z-20), on desktop it's inline */}
            <AnimatePresence initial={false}>
              {sidebarOpen && (
                <motion.aside
                  initial={{ width: 0 }}
                  animate={{ width: sidebarCollapsed ? 60 : 280 }}
                  exit={{ width: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className={`shrink-0 border-r border-border bg-sidebar overflow-hidden
                    ${isMobile ? 'fixed left-0 top-14 bottom-0 z-20' : 'relative'}
                  `}
                >
                  <Sidebar collapsed={sidebarCollapsed} />
                </motion.aside>
              )}
            </AnimatePresence>

            {/* Content area */}
            <main className="flex-1 overflow-auto min-w-0">
              {activeView === 'trash' ? (
                <TrashView />
              ) : (
                <ContentArea />
              )}
            </main>
          </div>

          {/* Sticky footer */}
          <footer className="mt-auto border-t border-border bg-background px-4 py-3 text-center text-xs text-muted-foreground">
            <p>Unified Workspace &copy; 2024 — Drive + Notes + Calculator</p>
          </footer>

          {/* Floating Calculator Widget */}
          <AnimatePresence>
            {isOpen && <CalculatorWidget />}
          </AnimatePresence>
        </div>
      </TooltipProvider>
    </WorkspaceDndProvider>
  );
}
