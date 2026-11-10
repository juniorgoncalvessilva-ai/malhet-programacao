"use client";

import { useEffect } from 'react';
import { useStoreInitialization } from '@/store';
import { useThemeSync } from '@/hooks/useThemeSync';
import { useLocaleSync } from '@/hooks/useLocaleSync';

/**
 * Provider component that initializes and syncs all Zustand stores
 * This should be used high in the component tree to ensure proper state management
 */
export function ZustandProvider({ children }: { children: React.ReactNode }) {
  // Initialize all stores
  useStoreInitialization();

  // Sync theme and locale with external providers
  const { theme } = useThemeSync();
  const { locale } = useLocaleSync();

  // Additional initialization logic
  useEffect(() => {
    // Any additional setup can go here
    console.log('Zustand stores initialized', { theme, locale });
  }, [theme, locale]);

  return <>{children}</>;
}