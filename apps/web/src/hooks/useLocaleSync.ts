"use client";

import { useEffect, useCallback } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useLocale as useNextIntlLocale } from 'next-intl';
import { useLocale, useSetLocale, useLocaleStore } from '@/store/locale-store';

/**
 * Hook to sync Zustand locale state with next-intl
 * This ensures both systems stay in sync
 */
function useNextIntlLocaleSafe(): string {
  try {
    return useNextIntlLocale();
  } catch (error) {
    // Return empty string when context is not available - will be handled by useEffect
    return '';
  }
}

export function useLocaleSync() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const nextIntlLocale = useNextIntlLocaleSafe();
  const zustandLocale = useLocale();
  const setZustandLocale = useSetLocale();
  
  // Get fallback locale from params if next-intl is not available
  const paramLocale = (params?.locale as string) || 'pt-BR';
  const effectiveNextIntlLocale = nextIntlLocale || paramLocale;

  // Sync next-intl locale changes to Zustand (when changed via routing)
  useEffect(() => {
    if (effectiveNextIntlLocale && effectiveNextIntlLocale !== zustandLocale) {
      // Update Zustand without triggering navigation
      useLocaleStore.setState({ locale: effectiveNextIntlLocale });
    }
  }, [effectiveNextIntlLocale, zustandLocale]);

  // Memoized function to change locale and sync both systems
  const setLocale = useCallback((newLocale: string) => {
    // Prevent unnecessary changes
    if (newLocale === zustandLocale && newLocale === effectiveNextIntlLocale) {
      return;
    }

    // Update Zustand state first
    setZustandLocale(newLocale);
    
    // Navigate to new locale URL only if pathname is available and locale is different
    if (pathname && newLocale !== effectiveNextIntlLocale) {
      try {
        // Remove current locale from pathname and add new one
        const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(-[A-Z]{2})?/, '') || '/';
        const newPath = `/${newLocale}${pathWithoutLocale}`;
        
        // Use replace to avoid adding to history stack
        router.replace(newPath);
      } catch (error) {
        console.error('Erro ao navegar para novo locale:', error);
        // Fallback: just push the locale change
        router.push(`/${newLocale}`);
      }
    }
  }, [zustandLocale, effectiveNextIntlLocale, pathname, router, setZustandLocale]);

  return {
    locale: zustandLocale,
    setLocale,
    availableLocales: ['pt-BR', 'en'], // TODO: Get from next-intl config
    isLoading: !effectiveNextIntlLocale, // Loading state when locale is not determined
  };
}