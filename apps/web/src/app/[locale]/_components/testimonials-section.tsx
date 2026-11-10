"use client";

import { useTranslations } from 'next-intl';
import Image from 'next/image';

const testimonials = [
  {
    key: 'carlos',
    rating: 5,
    avatar: '/images/user/user-01.png',
    company: 'TechStartup Brasil'
  },
  {
    key: 'ana',
    rating: 5,
    avatar: '/images/user/user-02.png',
    company: 'E-commerce Solutions'
  },
  {
    key: 'rafael',
    rating: 5,
    avatar: '/images/user/user-03.png',
    company: 'Fintech Innovation'
  },
  {
    key: 'maria',
    rating: 5,
    avatar: '/images/user/user-04.png',
    company: 'Digital Agency'
  },
  {
    key: 'pedro',
    rating: 5,
    avatar: '/images/user/user-05.png',
    company: 'SaaS Platform'
  },
  {
    key: 'julia',
    rating: 5,
    avatar: '/images/user/user-06.png',
    company: 'Healthcare Tech'
  }
];

const stats = [
  { key: 'developers', value: '2.5K+', icon: '👨‍💻' },
  { key: 'projects', value: '500+', icon: '🚀' },
  { key: 'countries', value: '25+', icon: '🌍' },
  { key: 'satisfaction', value: '98%', icon: '⭐' }
];

export function TestimonialsSection() {
  const t = useTranslations('Landing');

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <svg
        key={i}
        className={`h-5 w-5 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  return (
    <section className="py-24 bg-white dark:bg-gray-dark">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-dark dark:text-white sm:text-4xl">
            {t('testimonials.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            {t('testimonials.subtitle')}
          </p>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.key} className="text-center">
              <div className="text-3xl">{stat.icon}</div>
              <div className="mt-2 text-3xl font-bold text-dark dark:text-white">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t(`testimonials.stats.${stat.key}`)}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials Grid */}
        <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.key}
              className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:border-primary/20 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
            >
              {/* Rating */}
              <div className="flex space-x-1">
                {renderStars(testimonial.rating)}
              </div>

              {/* Quote */}
              <blockquote className="mt-4">
                <p className="text-gray-700 dark:text-gray-300">
                  &ldquo;{t(`testimonials.quotes.${testimonial.key}.text`)}&rdquo;
                </p>
              </blockquote>

              {/* Author */}
              <div className="mt-6 flex items-center">
                <Image
                  src={testimonial.avatar}
                  alt={t(`testimonials.quotes.${testimonial.key}.author`)}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div className="ml-4">
                  <div className="font-semibold text-dark dark:text-white">
                    {t(`testimonials.quotes.${testimonial.key}.author`)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t(`testimonials.quotes.${testimonial.key}.role`)} • {testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Feature Highlights */}
        <div className="mt-20 rounded-2xl bg-gradient-to-r from-primary/5 to-secondary/5 p-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-dark dark:text-white">
              {t('testimonials.highlights.title')}
            </h3>
            <p className="mx-auto mt-4 max-w-3xl text-gray-600 dark:text-gray-400">
              {t('testimonials.highlights.description')}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="text-4xl">⚡</div>
              <h4 className="mt-2 font-semibold text-dark dark:text-white">
                {t('testimonials.highlights.speed.title')}
              </h4>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {t('testimonials.highlights.speed.description')}
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl">🛡️</div>
              <h4 className="mt-2 font-semibold text-dark dark:text-white">
                {t('testimonials.highlights.reliability.title')}
              </h4>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {t('testimonials.highlights.reliability.description')}
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl">🚀</div>
              <h4 className="mt-2 font-semibold text-dark dark:text-white">
                {t('testimonials.highlights.growth.title')}
              </h4>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {t('testimonials.highlights.growth.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}