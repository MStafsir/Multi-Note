'use client';

// ============================================================
// MODUL 24.5: PWA Install Prompt
// Tracks visit count in localStorage
// After 3rd visit, shows a custom banner
// Uses beforeinstallprompt event for native install
// Dismiss banner on "Not now" and don't show again for 7 days
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const VISIT_COUNT_KEY = 'uw-visit-count';
const DISMISS_TIMESTAMP_KEY = 'uw-install-dismissed';
const MIN_VISITS = 3;
const DISMISS_DURATION_DAYS = 7;

export function InstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  // Check if we should show the banner — computed from localStorage (not setState in effect)
  const shouldShowBanner = useMemo(() => {
    // Check if already installed
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      return false;
    }

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_TIMESTAMP_KEY);
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < DISMISS_DURATION_DAYS) {
        return false;
      }
    }

    // Check visit count
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);
    return visitCount >= MIN_VISITS;
  }, []);

  // Increment visit count in a separate effect that doesn't setState
  useEffect(() => {
    const currentCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);
    localStorage.setItem(VISIT_COUNT_KEY, String(currentCount + 1));
  }, []);

  // Show banner based on computed value
  useEffect(() => {
    if (shouldShowBanner) {
      setShowBanner(true);
    }
  }, [shouldShowBanner]);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      // If dismissed recently, don't show
      const dismissedAt = localStorage.getItem(DISMISS_TIMESTAMP_KEY);
      if (dismissedAt) {
        const daysSinceDismissed = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < DISMISS_DURATION_DAYS) {
          return;
        }
      }
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Handle install click
  const handleInstall = useCallback(async () => {
    if (installEvent) {
      await installEvent.prompt();
      const choiceResult = await installEvent.userChoice;

      if (choiceResult.outcome === 'accepted') {
        setShowBanner(false);
        setInstallEvent(null);
      }
    } else {
      setShowBanner(false);
    }
  }, [installEvent]);

  // Handle dismiss — don't show again for 7 days
  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_TIMESTAMP_KEY, String(Date.now()));
  }, []);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-0 left-0 right-0 z-40 p-4 sm:p-6"
        >
          <div className="max-w-lg mx-auto bg-background border border-border rounded-xl shadow-xl p-4 flex items-center gap-4">
            {/* Icon */}
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted shrink-0">
              <Smartphone className="h-6 w-6 text-muted-foreground" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                Add to Home Screen
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Install Unified Workspace for quick access — it works like a native app!
              </p>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="default"
                size="sm"
                className="min-h-[44px]"
                onClick={handleInstall}
              >
                <Download className="h-4 w-4 mr-1" />
                Install
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[44px]"
                onClick={handleDismiss}
              >
                Not now
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 min-h-[44px] min-w-[44px] shrink-0"
                onClick={handleDismiss}
                aria-label="Dismiss install prompt"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
