"use client";

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAppConfig } from '@/config';

export function CtaSection() {
  const t = useTranslations('Landing');
  const { app, company } = useAppConfig();

  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-primary to-secondary py-24">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          {t('cta.title')}
        </h2>
        
        <p className="mx-auto mt-6 max-w-2xl text-xl text-primary-light">
          {t('cta.subtitle')}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
          <Link
            href="/auth/sign-up"
            className="inline-flex items-center rounded-lg bg-white px-8 py-4 text-lg font-semibold text-primary transition-all duration-300 hover:bg-gray-100 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary"
          >
            {t('cta.primary')}
            <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>

          <Link
            href="/auth/sign-in"
            className="inline-flex items-center rounded-lg border-2 border-white px-8 py-4 text-lg font-semibold text-white transition-all duration-300 hover:bg-white hover:text-primary focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary"
          >
            {t('cta.secondary')}
          </Link>
        </div>

        <div className="mt-8 text-sm text-primary-light">
          {t('cta.notice')}
        </div>
      </div>
    </section>
  );
}