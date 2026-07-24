'use client';

// ============================================================
// MODUL 22: Workspace Layout — Global Command Palette & Keyboard Shortcuts
// Cmd/Ctrl+K opens command palette (previously opened calculator)
// Calculator now uses Ctrl+Shift+K
// Additional global shortcuts: N (new note), F (new folder),
//   Delete (trash selected), Ctrl+Z (undo)
// All shortcuts check if user is typing (input/textarea/[contenteditable])
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, Calculator, Search, LogOut, X, Settings } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NotificationBadge } from '@/components/notifications/notification-badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sidebar } from './sidebar';
import { ContentArea } from './content-area';
import { CreateDialog } from './create-dialog';
import { useAuthStore } from '@/store/auth';
import { useCalculatorStore } from '@/store/calculator';
import { useFileTreeStore } from '@/store/file-tree';
import { useUndoStore } from '@/store/undo';
import { useDeleteNode } from '@/hooks/use-file-tree';
import { WorkspaceDndProvider } from '@/components/dnd/dnd-context';
import { CalculatorWidget } from '@/components/calculator/calculator-widget';
import { SearchDropdown } from '@/components/search/search-dropdown';
import { TrashView } from '@/components/trash/trash-view';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { CommandPalette } from '@/components/command/command-palette';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { DataPortabilitySettings } from '@/components/settings/data-portability';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { WelcomeSlides } from '@/components/onboarding/welcome-slides';
import { OnboardingChecklist, markOnboardingStep } from '@/components/onboarding/onboarding-checklist';

// Mobile breakpoint constant
const MOBILE_BREAKPOINT = 640;

export function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 22 — Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // 22 — Create dialogs triggered from command palette
  const [paletteCreateDialogOpen, setPaletteCreateDialogOpen] = useState(false);
  const [paletteCreateType, setPaletteCreateType] = useState<'folder' | 'note'>('note');

  // 28 — Settings dialog state
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Auth state — must be defined before queries that reference user
  const { user } = useAuthStore();
  const { toggleOpen, isOpen } = useCalculatorStore();
  const { setCurrentFolder, flatNodes, activeView, selectedNodeIds } = useFileTreeStore();
  const { popAction } = useUndoStore();
  const deleteMutation = useDeleteNode();

  // 39 — Onboarding state
  const [welcomeSlidesDismissed, setWelcomeSlidesDismissed] = useState(false);
  const queryClient = useQueryClient();

  const { data: onboardingData, isLoading: onboardingLoading } = useQuery({
    queryKey: ['onboarding'],
    queryFn: async () => {
      const res = await fetch('/api/onboarding');
      const data = await res.json();
      return data.data as {
        welcomeCompleted: boolean;
        sampleContentLoaded: boolean;
        checklistProgress: Record<string, boolean>;
        dismissedAt: string | null;
        steps: string[];
      };
    },
    enabled: !!user,
  });

  // 39 — Derived: show welcome slides when onboarding data indicates it's needed
  const showWelcomeSlides = onboardingData && !onboardingData.welcomeCompleted && !onboardingData.dismissedAt && !welcomeSlidesDismissed;

  const onboardingCompleteMutation = useMutation({
    mutationFn: async (payload: { welcomeCompleted?: boolean; dismiss?: boolean }) => {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  const handleWelcomeComplete = useCallback(() => {
    setWelcomeSlidesDismissed(true);
    onboardingCompleteMutation.mutate({ welcomeCompleted: true });
  }, [onboardingCompleteMutation]);

  const handleWelcomeDismiss = useCallback(() => {
    setWelcomeSlidesDismissed(true);
    onboardingCompleteMutation.mutate({ dismiss: true });
  }, [onboardingCompleteMutation]);

  const handleOnboardingDismiss = useCallback(() => {
    // Checklist was dismissed — no further action needed, state is already updated via mutation
  }, []);

  // 39 — Track onboarding step completions from user actions
  const handlePaletteCreateNote = useCallback(() => {
    setPaletteCreateType('note');
    setPaletteCreateDialogOpen(true);
    markOnboardingStep('create_note');
  }, []);

  const handlePaletteCreateFolder = useCallback(() => {
    setPaletteCreateType('folder');
    setPaletteCreateDialogOpen(true);
    markOnboardingStep('create_folder');
  }, []);

  // Auto-open sidebar on desktop, auto-close on mobile
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(true);
        setSidebarCollapsed(false);
      } else {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const searchRef = useRef<HTMLDivElement>(null);

  // 22 — Helper: check if user is typing in an input field
  const isUserTyping = useCallback((e: KeyboardEvent): boolean => {
    const target = e.target as HTMLElement;
    if (!target) return false;
    const tagName = target.tagName.toLowerCase();
    // Check if target is input, textarea, or contenteditable
    if (tagName === 'input' || tagName === 'textarea') return true;
    if (target.isContentEditable) return true;
    // Also check if target is inside a cmdk input (command palette)
    if (target.closest('[cmdk-input]')) return true;
    return false;
  }, []);

  // 22 — Global keyboard shortcuts (single useEffect with keydown listener)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Command Palette: Cmd/Ctrl+K (new shortcut, replaces old calculator shortcut)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        markOnboardingStep('use_command_palette');
        return;
      }

      // Calculator: Cmd/Ctrl+Shift+K (moved from Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        toggleOpen();
        markOnboardingStep('use_calculator');
        return;
      }

      // Search: Cmd/Ctrl+Shift+F
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setHeaderSearchOpen(true);
        markOnboardingStep('use_search');
        setTimeout(() => {
          const input = searchRef.current?.querySelector('input');
          if (input) input.focus();
        }, 50);
        return;
      }

      // Undo: Cmd/Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const action = popAction();
        if (action) {
          // Note: actual undo logic would be implemented per action type
          // This just pops from the stack; the real undo needs to be wired per action
          console.log('Undo action:', action.description);
        }
        return;
      }

      // Single-key shortcuts only work when user is NOT typing
      if (isUserTyping(e)) return;

      // Only process single-key shortcuts when no dialog/palette is open
      if (commandPaletteOpen) return;

      // New Note: N key
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setPaletteCreateType('note');
        setPaletteCreateDialogOpen(true);
        return;
      }

      // New Folder: F key
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setPaletteCreateType('folder');
        setPaletteCreateDialogOpen(true);
        return;
      }

      // Delete selected: Delete/Backspace key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedIds = Array.from(selectedNodeIds);
        if (selectedIds.length > 0) {
          e.preventDefault();
          // Delete the first selected item
          deleteMutation.mutate({ nodeId: selectedIds[0] });
        }
        return;
      }
    },
    [toggleOpen, isUserTyping, popAction, commandPaletteOpen, selectedNodeIds, deleteMutation]
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

  // Handle sidebar toggle
  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setSidebarOpen(prev => !prev);
    } else {
      if (sidebarOpen) {
        setSidebarCollapsed(!sidebarCollapsed);
      } else {
        setSidebarOpen(true);
        setSidebarCollapsed(false);
      }
    }
  }, [isMobile, sidebarOpen, sidebarCollapsed]);

  // Close sidebar (for backdrop click or swipe-down on mobile)
  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Drag state for mobile bottom-sheet
  const sheetY = useMotionValue(0);
  const sheetOpacity = useTransform(sheetY, [0, 200], [1, 0]);

  // Handle pan gesture on bottom sheet
  const handleSheetPan = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 80) {
      closeSidebar();
    }
  }, [closeSidebar]);



  return (
    <WorkspaceDndProvider>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col bg-background">
          {/* 29 — Skip-to-content link for keyboard users */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium focus:shadow-lg"
          >
            Skip to main content
          </a>

          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center h-14 px-4 gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 min-h-[44px] min-w-[44px]"
                onClick={toggleSidebar}
                aria-label={sidebarOpen ? (isMobile ? 'Close sidebar' : 'Collapse sidebar') : 'Open sidebar'}
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

              {/* Search button + command palette trigger */}
              <div className="flex items-center gap-2">
                {!headerSearchOpen ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground min-h-[44px]"
                    onClick={() => setCommandPaletteOpen(true)}
                    aria-label="Open command palette"
                  >
                    <Search className="h-4 w-4" />
                    <span className="text-sm">Search</span>
                    <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                      ⌘K
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

                {/* Mobile search/command palette button */}
                {!headerSearchOpen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden min-h-[44px] min-w-[44px]"
                    onClick={() => setCommandPaletteOpen(true)}
                    aria-label="Open command palette"
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Notification badge */}
                <NotificationBadge />

                {/* Calculator toggle button — updated shortcut tooltip */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isOpen ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-9 w-9 shrink-0 min-h-[44px] min-w-[44px]"
                      onClick={toggleOpen}
                      aria-label="Toggle calculator (Ctrl+Shift+K)"
                    >
                      <Calculator className={`h-4 w-4 ${isOpen ? 'text-orange-500' : 'text-muted-foreground'}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Calculator (Ctrl+Shift+K)</p>
                  </TooltipContent>
                </Tooltip>

                {/* User menu dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 h-auto p-1 rounded-full min-h-[44px] min-w-[44px]" aria-label={`User menu for ${user?.name || user?.email || 'User'}`}>
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
                      onClick={() => setSettingsDialogOpen(true)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
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
            {/* 29 — aria-live region for toast announcements */}
            <div aria-live="polite" aria-atomic="true" className="sr-only" id="a11y-announcements" />

            {/* ===== Mobile: Bottom-sheet drawer pattern ===== */}
            {isMobile && (
              <AnimatePresence initial={false}>
                {sidebarOpen && (
                  <>
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="fixed inset-0 bg-black/40 z-20"
                      onClick={closeSidebar}
                      role="button"
                      tabIndex={-1}
                      aria-label="Close sidebar overlay"
                    />

                    {/* Bottom sheet */}
                    <motion.aside
                      role="complementary"
                      aria-label="Sidebar navigation"
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      drag="y"
                      dragConstraints={{ top: 0 }}
                      dragElastic={0.2}
                      onDragEnd={handleSheetPan}
                      style={{ y: sheetY, opacity: sheetOpacity }}
                      className="fixed bottom-0 left-0 right-0 z-20 bg-sidebar border-t border-border rounded-t-2xl overflow-hidden shadow-xl"
                    >
                      {/* Drag handle bar */}
                      <div className="flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
                        <div className="w-12 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                      </div>

                      {/* Close button */}
                      <div className="absolute top-3 right-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 min-h-[44px] min-w-[44px]"
                          onClick={closeSidebar}
                          aria-label="Close sidebar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Sheet content */}
                      <div className="h-[60vh] overflow-auto">
                        <Sidebar collapsed={false} />
                      </div>
                    </motion.aside>
                  </>
                )}
              </AnimatePresence>
            )}

            {/* ===== Desktop: Left-side sidebar ===== */}
            {!isMobile && (
              <AnimatePresence initial={false}>
                {sidebarOpen && (
                  <motion.aside
                    role="complementary"
                    aria-label="Sidebar navigation"
                    initial={{ width: 0 }}
                    animate={{ width: sidebarCollapsed ? 60 : 280 }}
                    exit={{ width: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="shrink-0 border-r border-border bg-sidebar overflow-hidden relative"
                  >
                    <Sidebar collapsed={sidebarCollapsed} />
                  </motion.aside>
                )}
              </AnimatePresence>
            )}

            {/* Content area */}
            <main id="main-content" className="flex-1 overflow-auto min-w-0">
              {activeView === 'trash' ? (
                <TrashView />
              ) : activeView === 'admin' ? (
                <AdminDashboard />
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

          {/* 22 — Command Palette */}
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
            onCreateNote={handlePaletteCreateNote}
            onCreateFolder={handlePaletteCreateFolder}
          />

          {/* 22 — Create Dialog (triggered from command palette shortcuts) */}
          <CreateDialog
            open={paletteCreateDialogOpen}
            onOpenChange={setPaletteCreateDialogOpen}
            type={paletteCreateType}
          />

          {/* 39 — Onboarding: Welcome Slides */}
          <AnimatePresence>
            {showWelcomeSlides && (
              <WelcomeSlides
                onComplete={handleWelcomeComplete}
                onDismiss={handleWelcomeDismiss}
              />
            )}
          </AnimatePresence>

          {/* 39 — Onboarding: Checklist Widget */}
          {onboardingData && !onboardingData.dismissedAt && !showWelcomeSlides && (
            <OnboardingChecklist onDismiss={handleOnboardingDismiss} />
          )}

          {/* PWA Install Prompt */}
          <InstallPrompt />

          {/* 28 — Settings Dialog (Data Portability) */}
          <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>
                  Manage your data: export, import, or permanently delete your account.
                </DialogDescription>
              </DialogHeader>
              <DataPortabilitySettings />
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </WorkspaceDndProvider>
  );
}
