import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useMemo } from 'react';

interface LocaleState {
  locale: string;
  defaultLocale: string;
  availableLocales: string[];
  isRTL: boolean;
}

interface LocaleActions {
  setLocale: (locale: string) => void;
  setAvailableLocales: (locales: string[]) => void;
  toggleRTL: () => void;
}

type LocaleStore = LocaleState & LocaleActions;

const initialState: LocaleState = {
  locale: 'pt-BR',
  defaultLocale: 'pt-BR',
  availableLocales: ['pt-BR', 'en'],
  isRTL: false,
};

export const useLocaleStore = create<LocaleStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        setLocale: (locale) => {
          set((state) => {
            state.locale = locale;
            // Auto-detect RTL languages
            state.isRTL = ['ar', 'he', 'fa', 'ur'].some(rtlLang => locale.startsWith(rtlLang));
          });
          
          // Update document lang attribute
          if (typeof window !== 'undefined') {
            document.documentElement.lang = locale;
          }
        },

        setAvailableLocales: (locales) => {
          set((state) => {
            state.availableLocales = locales;
          });
        },

        toggleRTL: () => {
          set((state) => {
            state.isRTL = !state.isRTL;
          });
        },
      })),
      {
        name: 'locale-store',
        partialize: (state) => ({
          locale: state.locale,
          isRTL: state.isRTL,
        }),
      }
    ),
    {
      name: 'locale-store',
    }
  )
);

// Selectors
export const useLocale = () => useLocaleStore((state) => state.locale);
export const useDefaultLocale = () => useLocaleStore((state) => state.defaultLocale);
export const useAvailableLocales = () => useLocaleStore((state) => state.availableLocales);
export const useIsRTL = () => useLocaleStore((state) => state.isRTL);

// Memoized locale state for backward compatibility
export const useLocaleState = () => {
  const locale = useLocaleStore((state) => state.locale);
  const defaultLocale = useLocaleStore((state) => state.defaultLocale);
  const availableLocales = useLocaleStore((state) => state.availableLocales);
  const isRTL = useLocaleStore((state) => state.isRTL);
  
  return useMemo(() => ({
    locale,
    defaultLocale,
    availableLocales,
    isRTL,
  }), [locale, defaultLocale, availableLocales, isRTL]);
};

// Individual action selectors
export const useSetLocale = () => useLocaleStore((state) => state.setLocale);
export const useSetAvailableLocales = () => useLocaleStore((state) => state.setAvailableLocales);
export const useToggleRTL = () => useLocaleStore((state) => state.toggleRTL);

// For backward compatibility, provide a hook that uses memoized object
export const useLocaleActions = () => {
  const setLocale = useLocaleStore((state) => state.setLocale);
  const setAvailableLocales = useLocaleStore((state) => state.setAvailableLocales);
  const toggleRTL = useLocaleStore((state) => state.toggleRTL);
  
  return useMemo(() => ({
    setLocale,
    setAvailableLocales,
    toggleRTL,
  }), [setLocale, setAvailableLocales, toggleRTL]);
};