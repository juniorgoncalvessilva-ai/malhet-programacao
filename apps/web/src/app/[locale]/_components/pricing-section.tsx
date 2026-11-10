"use client";

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const plans = [
  {
    key: 'starter',
    icon: '🚀',
    popular: false,
    price: 49,
    originalPrice: 99,
    period: 'forever',
    badge: 'Early Bird'
  },
  {
    key: 'pro',
    icon: '⭐',
    popular: true,
    price: 99,
    originalPrice: 199,
    period: 'forever',
    badge: 'Most Popular'
  },
  {
    key: 'enterprise',
    icon: '🏢',
    popular: false,
    price: 299,
    originalPrice: 499,
    period: 'forever',
    badge: 'Complete'
  }
];

// Features will be loaded from translations

export function PricingSection() {
  const t = useTranslations('Landing');

  return (
    <section className="py-24 bg-gray-50 dark:bg-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-dark dark:text-white sm:text-4xl">
            {t('pricing.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            {t('pricing.subtitle')}
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mt-20 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-2xl border-2 bg-white p-8 shadow-lg transition-all duration-300 hover:shadow-xl dark:bg-gray-900 ${
                plan.popular 
                  ? 'border-primary scale-105 ring-4 ring-primary/20' 
                  : 'border-gray-200 hover:border-primary/50 dark:border-gray-700'
              }`}
            >
              {/* Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className={`rounded-full px-4 py-2 text-sm font-medium text-white ${
                  plan.popular 
                    ? 'bg-primary' 
                    : plan.badge === 'Early Bird' 
                      ? 'bg-green-500' 
                      : 'bg-gray-600'
                }`}>
                  {plan.popular ? t('pricing.popular') : plan.badge}
                </div>
              </div>

              {/* Plan Header */}
              <div className="text-center">
                <div className="text-4xl">{plan.icon}</div>
                <h3 className="mt-4 text-2xl font-bold text-dark dark:text-white">
                  {t(`pricing.plans.${plan.key}.name`)}
                </h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  {t(`pricing.plans.${plan.key}.description`)}
                </p>
              </div>

              {/* Price */}
              <div className="mt-6 text-center">
                {/* Original Price (strikethrough) */}
                <div className="mb-2">
                  <span className="text-lg text-gray-400 line-through dark:text-gray-500">
                    ${plan.originalPrice}
                  </span>
                </div>
                
                <div className="flex items-baseline justify-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">$</span>
                  <span className="text-4xl font-bold text-dark dark:text-white">
                    {plan.price}
                  </span>
                  <span className="ml-1 text-gray-500 dark:text-gray-400">
                    /{t(`pricing.periods.${plan.period}`)}
                  </span>
                </div>
              </div>

              {/* Features */}
              <div className="mt-8">
                <ul className="space-y-3">
                  {t.raw(`pricing.plans.${plan.key}.features`).map((feature: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <svg className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA Button */}
              <div className="mt-8">
                <Link
                  href="#contact"
                  className={`block w-full rounded-lg px-6 py-3 text-center text-base font-medium transition-colors ${
                    plan.popular
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  {t(`pricing.plans.${plan.key}.cta`)}
                </Link>
              </div>

              {/* Additional Info */}
              {plan.key === 'enterprise' && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('pricing.customPricing')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom Notice */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('pricing.notice')}
          </p>
        </div>
      </div>
    </section>
  );
}