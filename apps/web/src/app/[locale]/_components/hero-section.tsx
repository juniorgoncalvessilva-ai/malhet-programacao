"use client";

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { useAppConfig } from '@/config';

export function HeroSection() {
  const t = useTranslations('Landing');
  const { app, company } = useAppConfig();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-white to-primary/10 dark:from-primary/10 dark:via-gray-dark dark:to-primary/5">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary dark:bg-primary/20">
              <span className="mr-2 flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              {t('badge', { version: app.version })}
            </div>

            {/* Heading */}
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-dark dark:text-white sm:text-5xl lg:text-6xl">
                {t('hero.title')}
                <span className="text-primary"> {app.name}</span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
                {t('hero.subtitle')}
              </p>
            </div>

            {/* Features list */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                'hero.features.auth',
                'hero.features.i18n', 
                'hero.features.validation',
                'hero.features.responsive'
              ].map((key) => (
                <div key={key} className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">{t(key)}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-medium text-white transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                {t('hero.cta.primary')}
                <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              
              <Link
                href="/auth/sign-in"
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('hero.cta.secondary')}
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('hero.trust')}
              </p>
              <div className="mt-3 flex items-center space-x-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  ⚡ Next.js 15
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  🛡️ TypeScript
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  🎨 Tailwind CSS
                </div>
              </div>
            </div>
          </div>

          {/* Image/Demo */}
          <div className="relative">
            <div className="relative rounded-2xl bg-white p-4 shadow-2xl dark:bg-gray-800">
              <Image
                src="/images/illustration/illustration-01.svg"
                alt={`${app.name} Dashboard Preview`}
                width={600}
                height={400}
                className="w-full rounded-lg"
                priority
              />
              
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 rounded-lg bg-primary p-3 text-white shadow-lg">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              
              <div className="absolute -bottom-4 -left-4 rounded-lg bg-green-500 p-3 text-white shadow-lg">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}