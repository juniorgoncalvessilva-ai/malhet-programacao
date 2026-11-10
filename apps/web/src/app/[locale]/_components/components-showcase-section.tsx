"use client";

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const componentCategories = [
  {
    key: 'dashboard',
    icon: '📊',
    color: 'from-blue-500 to-cyan-500',
    count: '8+'
  },
  {
    key: 'charts',
    icon: '📈',
    color: 'from-green-500 to-emerald-500',
    count: '12+'
  },
  {
    key: 'ui',
    icon: '🧩',
    color: 'from-purple-500 to-pink-500',
    count: '25+'
  },
  {
    key: 'forms',
    icon: '📝',
    color: 'from-orange-500 to-red-500',
    count: '15+'
  },
  {
    key: 'layout',
    icon: '🧭',
    color: 'from-indigo-500 to-purple-500',
    count: '10+'
  },
  {
    key: 'examples',
    icon: '📄',
    color: 'from-cyan-500 to-blue-500',
    count: '20+'
  }
];

const features = [
  {
    key: 'auth',
    icon: '🔐'
  },
  {
    key: 'i18n',
    icon: '🌍'
  },
  {
    key: 'theme',
    icon: '🎨'
  },
  {
    key: 'responsive',
    icon: '📱'
  },
  {
    key: 'performance',
    icon: '⚡'
  },
  {
    key: 'dx',
    icon: '🔧'
  }
];

export function ComponentsShowcaseSection() {
  const t = useTranslations('Landing');

  return (
    <section className="py-24 bg-white dark:bg-gray-dark">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-dark dark:text-white sm:text-4xl">
            {t('components.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg text-gray-600 dark:text-gray-400">
            {t('components.subtitle')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.key}
              className="group rounded-2xl bg-gray-50 p-6 transition-all duration-300 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <div className="flex items-start space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-dark dark:text-white">
                    {t(`components.features.${feature.key}.title`)}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {t(`components.features.${feature.key}.description`)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Components Categories */}
        <div className="mt-24">
          <div className="text-center mb-16">
            <h3 className="text-2xl font-bold text-dark dark:text-white">
              {t('components.categoriesTitle')}
            </h3>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              {t('components.categoriesSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {componentCategories.map((category) => (
              <div
                key={category.key}
                className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg dark:bg-gray-900"
              >
                {/* Gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 transition-opacity duration-300 group-hover:opacity-5`} />
                
                {/* Content */}
                <div className="relative">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-2xl dark:bg-gray-800">
                      {category.icon}
                    </div>
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                      {category.count}
                    </div>
                  </div>

                  {/* Title */}
                  <h4 className="mt-4 text-lg font-semibold text-dark dark:text-white">
                    {t(`components.categories.${category.key}.name`)}
                  </h4>

                  {/* Items */}
                  <div className="mt-4 space-y-2">
                    {t.raw(`components.categories.${category.key}.items`).slice(0, 6).map((item: string, index: number) => (
                      <div key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <svg className="mr-2 h-3 w-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {item}
                      </div>
                    ))}
                    {t.raw(`components.categories.${category.key}.items`).length > 6 && (
                      <div className="text-sm text-primary font-medium">
                        +{t.raw(`components.categories.${category.key}.items`).length - 6} {t('components.moreItems')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 p-8 text-center">
          <h3 className="text-2xl font-bold text-dark dark:text-white">
            {t('components.cta.title')}
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-gray-600 dark:text-gray-400">
            {t('components.cta.description')}
          </p>
          
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/app/ui-elements"
              className="inline-flex items-center rounded-lg bg-primary px-6 py-3 text-base font-medium text-white transition-colors hover:bg-primary/90"
            >
              {t('components.cta.viewComponents')}
              <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            
            <Link
              href="/app/docs"
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {t('components.cta.documentation')}
              <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}