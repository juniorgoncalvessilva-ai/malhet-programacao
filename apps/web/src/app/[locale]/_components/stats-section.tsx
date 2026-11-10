"use client";

import { useTranslations } from 'next-intl';
import { useAppConfig } from '@/config';

const stats = [
  { key: 'components', value: '200+' },
  { key: 'pages', value: '45+' },
  { key: 'frameworks', value: '10+' },
  { key: 'languages', value: '2' },
];

export function StatsSection() {
  const t = useTranslations('Landing');
  const { app } = useAppConfig();

  return (
    <section className="py-16 bg-primary text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t('stats.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-light">
            {t('stats.subtitle')}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.key} className="text-center">
              <div className="text-4xl font-bold tracking-tight sm:text-5xl">
                {stat.value}
              </div>
              <div className="mt-2 text-lg font-medium text-primary-light">
                {t(`stats.items.${stat.key}`)}
              </div>
            </div>
          ))}
        </div>

        {/* Additional info */}
        <div className="mt-12 text-center">
          <p className="text-lg text-primary-light">
            {t('stats.description')}
          </p>
        </div>
      </div>
    </section>
  );
}