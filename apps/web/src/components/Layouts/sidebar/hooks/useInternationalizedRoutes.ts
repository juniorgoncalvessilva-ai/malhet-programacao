import { useMemo } from 'react';
import { useLocale } from 'next-intl';

// Since we're using next-intl's Link component, we don't need manual URL mapping
// The Link component automatically handles locale prefixing
// This hook now focuses on route matching logic

export function useInternationalizedRoutes() {
  const locale = useLocale();

  // For route matching, we just need to compare the base URLs
  // The next-intl system handles the prefixing automatically
  const isRouteActive = useMemo(() => (currentPath: string, targetRoute: string): boolean => {
    // Remove locale prefix from currentPath for comparison
    const pathWithoutLocale = currentPath.replace(`/${locale}`, '') || '/';
    return pathWithoutLocale === targetRoute;
  }, [locale]);

  // Since next-intl Link handles prefixing, we just return the original route
  const getLocalizedRoute = useMemo(() => (route: string): string => {
    return route;
  }, []);

  return {
    getLocalizedRoute,
    isRouteActive,
    locale,
  };
}

// Helper function to generate slug from title (useful for dynamic routes)
export function generateSlugFromTitle(title: string, locale: string): string {
  const normalizedTitle = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  // Apply locale-specific transformations if needed
  if (locale === 'pt-BR') {
    return normalizedTitle
      .replace(/ç/g, 'c')
      .replace(/[áàâã]/g, 'a')
      .replace(/[éèê]/g, 'e')
      .replace(/[íì]/g, 'i')
      .replace(/[óòôõ]/g, 'o')
      .replace(/[úù]/g, 'u');
  }

  return normalizedTitle;
} 