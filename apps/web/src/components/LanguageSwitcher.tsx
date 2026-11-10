"use client";

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from "@/lib/utils";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { useLocaleSync } from "@/hooks/useLocaleSync";

const languages = [
  { code: 'pt-BR', name: 'Português (BR)', flag: '🇧🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' }
];

export function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const locale = useLocale();
  const t = useTranslations('Common');
  
  // Use the synchronized locale system instead of direct next-intl navigation
  const { setLocale: setSyncedLocale } = useLocaleSync();

  const currentLanguage = languages.find(lang => lang.code === locale) || languages[0];

  const handleLanguageChange = async (newLocale: string) => {
    if (newLocale === locale) {
      setIsOpen(false);
      return;
    }

    try {
      setIsChanging(true);
      
      // Salvar preferência no cookie
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=lax`;
      
      // Use the synced locale setter that handles both Zustand and next-intl
      setSyncedLocale(newLocale);
      
      setIsOpen(false);
    } catch (error) {
      console.error('Erro ao trocar idioma:', error);
    } finally {
      // Reset changing state after a brief delay to allow navigation
      setTimeout(() => setIsChanging(false), 1000);
    }
  };

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="rounded align-middle outline-none ring-primary ring-offset-2 focus-visible:ring-1 dark:ring-offset-gray-dark">
        <span className="sr-only">{t('language')}</span>
        
        <div className={cn(
          "flex items-center gap-2 rounded-lg border border-stroke bg-white px-3 py-2 text-dark dark:border-dark-3 dark:bg-gray-dark dark:text-white hover:bg-gray-2 dark:hover:bg-dark-2 transition-colors",
          isChanging && "opacity-60 cursor-wait"
        )}>
          {isChanging ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <span className="text-lg">{currentLanguage.flag}</span>
          )}
          <span className="hidden sm:inline text-sm font-medium">
            {currentLanguage.code === 'pt-BR' ? 'PT' : 'EN'}
          </span>
          <svg
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </DropdownTrigger>

      <DropdownContent
        className="border border-stroke bg-white shadow-md dark:border-dark-3 dark:bg-gray-dark min-w-[180px]"
        align="end"
      >
        <h2 className="sr-only">{t('language')}</h2>
        
        <div className="p-2">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              disabled={isChanging}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-2 dark:hover:bg-dark-3 transition-colors",
                locale === language.code && "bg-primary text-white hover:bg-primary/90 dark:hover:bg-primary/90",
                isChanging && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className="text-lg">{language.flag}</span>
              <span className="font-medium">{language.name}</span>
              {locale === language.code && (
                <svg className="ml-auto h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </DropdownContent>
    </Dropdown>
  );
}