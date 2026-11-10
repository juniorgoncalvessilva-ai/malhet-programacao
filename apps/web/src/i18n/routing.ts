import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['pt-BR', 'en'],

  // Used when no locale matches
  defaultLocale: 'pt-BR',
  
  // The locale prefix configuration
  localePrefix: 'always',
  
  // Disable automatic locale detection if you want full control
  localeDetection: true
});

// Export the locales for use in other files
export const locales = routing.locales; 