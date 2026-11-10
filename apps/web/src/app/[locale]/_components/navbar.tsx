"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { useAppConfig } from '@/config';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggleSwitch } from '@/components/Layouts/header/theme-toggle';
import { useUser } from '@clerk/nextjs';

export function LandingNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const t = useTranslations('Landing');
  const { app, company } = useAppConfig();
  const { isSignedIn } = useUser();

  const navigation = [
    { name: t('navbar.features'), href: '#features' },
    { name: t('navbar.about'), href: '#about' },
    { name: t('navbar.docs'), href: '/app/docs' },
    { name: t('navbar.contact'), href: '#contact' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200 dark:bg-gray-dark/80 dark:border-gray-700">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/images/logo/logo-icon.svg"
                alt={`${app.name} Logo`}
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="text-xl font-bold text-dark dark:text-white">
                {app.name}
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="flex items-center space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-gray-700 hover:text-primary dark:text-gray-300 dark:hover:text-primary transition-colors duration-200"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            <ThemeToggleSwitch />
            <LanguageSwitcher />
            
            <div className="hidden sm:flex items-center space-x-3">
              {isSignedIn ? (
                <Link
                  href="/app/dashboard"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                  {t('navbar.dashboard')}
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/sign-in"
                    className="text-gray-700 hover:text-primary dark:text-gray-300 dark:hover:text-primary transition-colors duration-200"
                  >
                    {t('navbar.signIn')}
                  </Link>
                  <Link
                    href="/auth/sign-up"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                  >
                    {t('navbar.signUp')}
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden rounded-lg p-2 text-gray-700 hover:bg-gray-100 hover:text-primary dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-primary"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="sr-only">Open menu</span>
              {isMenuOpen ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="space-y-1 pb-3 pt-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-primary dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-primary"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              
              <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                <div className="space-y-2">
                  {isSignedIn ? (
                    <Link
                      href="/app/dashboard"
                      className="block rounded-lg bg-primary px-3 py-2 text-white hover:bg-primary/90"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {t('navbar.dashboard')}
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/auth/sign-in"
                        className="block rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-primary dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-primary"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {t('navbar.signIn')}
                      </Link>
                      <Link
                        href="/auth/sign-up"
                        className="block rounded-lg bg-primary px-3 py-2 text-white hover:bg-primary/90"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {t('navbar.signUp')}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}