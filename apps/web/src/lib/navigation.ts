import { createNavigation } from 'next-intl/navigation';
import { routing } from '@/i18n/routing';

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);

/**
 * Helper function to get the current locale from pathname
 */
export function getLocaleFromPathname(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  
  if (routing.locales.includes(firstSegment as any)) {
    return firstSegment;
  }
  
  return routing.defaultLocale;
}

/**
 * Helper function to add locale to a pathname if missing
 */
export function addLocaleToPathname(pathname: string, locale?: string): string {
  const targetLocale = locale || routing.defaultLocale;
  
  // Check if pathname already has a locale
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  
  if (routing.locales.includes(firstSegment as any)) {
    return pathname; // Already has locale
  }
  
  // Add locale to pathname
  return `/${targetLocale}${pathname}`;
}

/**
 * Helper function to remove locale from pathname
 */
export function removeLocaleFromPathname(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  
  if (routing.locales.includes(firstSegment as any)) {
    return '/' + segments.slice(1).join('/');
  }
  
  return pathname;
}