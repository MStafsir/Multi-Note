'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from './sidebar';
import { ContentArea } from './content-area';
import { useAuthStore } from '@/store/auth';
import { WorkspaceDndProvider } from '@/components/dnd/dnd-context';

export function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuthStore();

  return (
    <WorkspaceDndProvider>
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
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed || !sidebarOpen ? (
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

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-sm text-muted-foreground">
                {user?.email}
              </div>
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-medium">
                {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
              </div>
            </div>
          </div>
        </header>

        {/* Main content: sidebar + workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <AnimatePresence initial={false}>
            {sidebarOpen && (
              <motion.aside
                initial={{ width: 0 }}
                animate={{ width: sidebarCollapsed ? 60 : 280 }}
                exit={{ width: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="shrink-0 border-r border-border bg-sidebar overflow-hidden"
              >
                <Sidebar collapsed={sidebarCollapsed} />
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Content area */}
          <main className="flex-1 overflow-auto">
            <ContentArea />
          </main>
        </div>

        {/* Sticky footer */}
        <footer className="mt-auto border-t border-border bg-background px-4 py-3 text-center text-xs text-muted-foreground">
          <p>Unified Workspace &copy; 2024 — Drive + Notes + Calculator</p>
        </footer>
      </div>
    </WorkspaceDndProvider>
  );
}
