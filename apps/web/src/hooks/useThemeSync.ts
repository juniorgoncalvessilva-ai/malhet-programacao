"use client";

import { useEffect } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { useTheme, useSetTheme, useUIStore } from '@/store/ui-store';

/**
 * Hook to sync Zustand theme state with next-themes
 * This ensures both systems stay in sync
 */
export function useThemeSync() {
  const { theme: nextTheme, setTheme: setNextTheme } = useNextTheme();
  const zustandTheme = useTheme();
  const setZustandTheme = useSetTheme();

  // Sync next-themes changes to Zustand (when changed externally)
  useEffect(() => {
    if (nextTheme && nextTheme !== zustandTheme) {
      // Update Zustand without triggering next-themes sync
      useUIStore.setState({ theme: nextTheme as 'light' | 'dark' | 'system' });
    }
  }, [nextTheme, zustandTheme]);

  // Return the Zustand setter that will sync both
  return {
    theme: zustandTheme,
    setTheme: (theme: 'light' | 'dark' | 'system') => {
      setZustandTheme(theme);
      setNextTheme(theme);
    },
  };
}