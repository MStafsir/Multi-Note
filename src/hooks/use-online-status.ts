'use client';

// ============================================================
// 56.4 — Fixed: navigator.onLine is not available during SSR.
// Uses useSyncExternalStore for correct SSR hydration behavior:
//   - getServerSnapshot returns true (safe SSR default)
//   - getSnapshot returns navigator.onLine (client-only)
//   - subscribe listens for online/offline events
// This prevents React hydration mismatch warnings and avoids
// the lint warning about setState in effect.
// ============================================================

import { useSyncExternalStore, useCallback } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true; // Assume online during SSR — prevents hydration mismatch
}

export function useOnlineStatus() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { isOnline, isOffline: !isOnline };
}
