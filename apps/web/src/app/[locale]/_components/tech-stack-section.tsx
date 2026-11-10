"use client";

import { useTranslations } from 'next-intl';
import Image from 'next/image';

const techStack = [
  {
    key: 'nextjs',
    icon: '⚛️',
    color: 'from-blue-500 to-cyan-500',
    website: 'https://nextjs.org',
    category: 'framework'
  },
  {
    key: 'react',
    icon: '⚛️',
    color: 'from-blue-400 to-blue-600',
    website: 'https://react.dev',
    category: 'framework'
  },
  {
    key: 'typescript',
    icon: '🔷',
    color: 'from-blue-600 to-blue-800',
    website: 'https://typescriptlang.org',
    category: 'language'
  },
  {
    key: 'tailwindcss',
    icon: '🎨',
    color: 'from-cyan-500 to-teal-500',
    website: 'https://tailwindcss.com',
    category: 'styling'
  },
  {
    key: 'clerk',
    icon: '🔐',
    color: 'from-purple-500 to-pink-500',
    website: 'https://clerk.com',
    category: 'auth'
  },
  {
    key: 'supabase',
    icon: '🗄️',
    color: 'from-green-400 to-emerald-500',
    website: 'https://supabase.com',
    category: 'database'
  },
  {
    key: 'tanstack',
    icon: '🔄',
    color: 'from-red-500 to-orange-500',
    website: 'https://tanstack.com/query',
    category: 'data'
  },
  {
    key: 'zustand',
    icon: '🐻',
    color: 'from-amber-500 to-yellow-500',
    website: 'https://zustand-demo.pmnd.rs',
    category: 'state'
  },
  {
    key: 'hookform',
    icon: '📝',
    color: 'from-orange-500 to-red-500',
    website: 'https://react-hook-form.com',
    category: 'forms'
  },
  {
    key: 'zod',
    icon: '✅',
    color: 'from-green-500 to-emerald-500',
    website: 'https://zod.dev',
    category: 'validation'
  },
  {
    key: 'nextintl',
    icon: '🌍',
    color: 'from-indigo-500 to-purple-500',
    website: 'https://next-intl-docs.vercel.app',
    category: 'i18n'
  },
  {
    key: 'apexcharts',
    icon: '📊',
    color: 'from-yellow-500 to-orange-500',
    website: 'https://apexcharts.com',
    category: 'charts'
  },
  {
    key: 'radixui',
    icon: '🧩',
    color: 'from-violet-500 to-purple-500',
    website: 'https://radix-ui.com',
    category: 'ui'
  },
  {
    key: 'lucide',
    icon: '🎯',
    color: 'from-slate-500 to-gray-600',
    website: 'https://lucide.dev',
    category: 'icons'
  },
  {
    key: 'sonner',
    icon: '🔔',
    color: 'from-emerald-500 to-teal-500',
    website: 'https://sonner.emilkowal.ski',
    category: 'notifications'
  },
  {
    key: 'embla',
    icon: '🎠',
    color: 'from-pink-500 to-rose-500',
    website: 'https://embla-carousel.com',
    category: 'carousel'
  }
];

export function TechStackSection() {
  const t = useTranslations('Landing');

  return (
    <section className="py-24 bg-gray-50 dark:bg-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-dark dark:text-white sm:text-4xl">
            {t('techStack.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            {t('techStack.subtitle')}
          </p>
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">16+</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('techStack.stats.technologies')}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">50+</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('techStack.stats.components')}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">100%</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('techStack.stats.typescript')}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">2+</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('techStack.stats.languages')}</div>
          </div>
        </div>

        {/* Tech Stack Grid */}
        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {techStack.map((tech) => (
            <div
              key={tech.key}
              className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 dark:bg-gray-900"
            >
              {/* Gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${tech.color} opacity-0 transition-opacity duration-300 group-hover:opacity-10`} />
              
              {/* Content */}
              <div className="relative">
                {/* Icon & Category */}
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-2xl dark:bg-gray-800 group-hover:scale-110 transition-transform duration-300">
                    {tech.icon}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">
                    {tech.category}
                  </div>
                </div>

                {/* Text */}
                <div className="mt-4">
                  <h3 className="text-lg font-semibold text-dark dark:text-white group-hover:text-primary transition-colors duration-300">
                    {t(`techStack.technologies.${tech.key}.name`)}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {t(`techStack.technologies.${tech.key}.description`)}
                  </p>
                </div>

                {/* Link */}
                <div className="mt-4">
                  <a
                    href={tech.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors duration-200"
                  >
                    {t('techStack.learnMore')}
                    <svg className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center rounded-full bg-white px-6 py-3 shadow-sm dark:bg-gray-900">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('techStack.cta')}
            </span>
            <svg className="ml-2 h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}