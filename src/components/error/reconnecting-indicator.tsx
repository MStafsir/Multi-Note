'use client';

// ============================================================
// MODUL 26.5: Reconnecting Indicator
// Handles Module 10.1 realtime connection drops:
// - Shows "Reconnecting..." with animated pulse
// - Auto-dismisses when connection returns
// - Falls back to polling at 5s interval when realtime drops
// - Graceful degradation for realtime connection failure
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';

interface ReconnectingIndicatorProps {
  /** Whether the realtime connection is currently disconnected */
  isDisconnected?: boolean;
  /** Callback when connection is restored (indicator auto-dismisses) */
  onReconnected?: () => void;
  /** Polling function to call at 5s interval as fallback */
  pollFn?: () => Promise<void>;
  /** Polling interval in ms (default 5000) */
  pollingInterval?: number;
}

export function ReconnectingIndicator({
  isDisconnected = false,
  onReconnected,
  pollFn,
  pollingInterval = 5000,
}: ReconnectingIndicatorProps) {
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const attemptRef = useRef(0);

  // Derived state: avoid setState in effect
  const isReconnecting = isDisconnected;
  const isPollingActive = isDisconnected && pollFn;

  // When disconnection status changes, handle cleanup
  useEffect(() => {
    if (!isDisconnected) {
      // Connection restored — cleanup polling
      attemptRef.current = 0;

      // Clear polling interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      // Notify parent
      if (onReconnected) {
        onReconnected();
      }
    }
  }, [isDisconnected, onReconnected]);

  // Start polling fallback when disconnected
  useEffect(() => {
    if (isDisconnected && pollFn && !pollIntervalRef.current) {
      // Reset attempt counter for new disconnection session
      attemptRef.current = 0;

      // Start polling at configured interval
      pollIntervalRef.current = setInterval(async () => {
        try {
          await pollFn();
          attemptRef.current += 1;
          setReconnectAttempt(attemptRef.current);
        } catch {
          // Polling also failed — increment attempt counter
          attemptRef.current += 1;
          setReconnectAttempt(attemptRef.current);
        }
      }, pollingInterval);

      // Also run immediately on first disconnect
      pollFn().catch(() => {
        attemptRef.current += 1;
        setReconnectAttempt(attemptRef.current);
      });
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isDisconnected, pollFn, pollingInterval]);

  // Manual reconnect attempt
  const handleManualReconnect = useCallback(() => {
    attemptRef.current += 1;
    setReconnectAttempt(attemptRef.current);
    // The actual reconnect is handled by the socket.io reconnection logic
    // or the polling fallback. This button just signals user intent.
  }, []);

  // Only show attempt count when actually disconnected
  const displayAttempt = isReconnecting ? reconnectAttempt : 0;

  return (
    <AnimatePresence>
      {isReconnecting && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-center gap-2 py-2 px-4 bg-warning/10 border-b border-warning/30 text-warning">
            {/* Animated pulse dot */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-2 h-2 rounded-full bg-warning"
            />

            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Reconnecting...</span>

            {isPollingActive && (
              <span className="text-xs text-warning/70">
                (polling every {pollingInterval / 1000}s)
              </span>
            )}

            {displayAttempt > 0 && (
              <span className="text-xs text-warning/70">
                Attempt {displayAttempt}
              </span>
            )}

            <button
              onClick={handleManualReconnect}
              className="ml-2 inline-flex items-center gap-1 text-xs text-warning hover:text-warning/80 underline min-h-[44px]"
              aria-label="Retry connection"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
