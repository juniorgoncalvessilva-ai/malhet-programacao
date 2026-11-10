"use client";

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const documentationSections = [
  {
    key: 'structure',
    icon: '🏗️',
    docs: ['estrutura-geral', 'paginas-rotas', 'componentes']
  },
  {
    key: 'features',
    icon: '🚀',
    docs: ['autenticacao', 'internacionalizacao', 'validacao-formularios', 'configuracao-central']
  },
  {
    key: 'styling',
    icon: '🎨',
    docs: ['tema-estilos', 'diagramas-mermaid']
  },
  {
    key: 'deployment',
    icon: '🔧',
    docs: ['configuracoes', 'deploy', 'guia-desenvolvimento']
  }
];

const highlights = [
  {
    key: 'comprehensive',
    icon: '📚',
    metric: '13+',
    unit: 'guides'
  },
  {
    key: 'examples',
    icon: '💡',
    metric: '50+',
    unit: 'examples'
  },
  {
    key: 'diagrams',
    icon: '📊',
    metric: '10+',
    unit: 'diagrams'
  },
  {
    key: 'updated',
    icon: '🔄',
    metric: 'Always',
    unit: 'updated'
  }
];

export function DocumentationSection() {
  const t = useTranslations('Landing');

  return (
    <section className="py-24 bg-white dark:bg-gray-dark">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-dark dark:text-white sm:text-4xl">
            {t('documentation.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            {t('documentation.subtitle')}
          </p>
        </div>

        {/* Highlights */}
        <div className="mt-16 grid grid-cols-2 gap-8 md:grid-cols-4">
          {highlights.map((highlight) => (
            <div
              key={highlight.key}
              className="text-center"
            >
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl">
                  {highlight.icon}
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-dark dark:text-white">
                  {highlight.metric}
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t(`documentation.highlights.${highlight.key}`)} {highlight.unit !== 'updated' && highlight.unit}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Documentation Sections */}
        <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {documentationSections.map((section) => (
            <div
              key={section.key}
              className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 hover:border-primary/20 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
            >
              {/* Icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                {section.icon}
              </div>

              {/* Content */}
              <div className="mt-4">
                <h3 className="text-lg font-semibold text-dark dark:text-white">
                  {t(`documentation.sections.${section.key}.title`)}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t(`documentation.sections.${section.key}.description`)}
                </p>
              </div>

              {/* Doc Links */}
              <div className="mt-4 space-y-2">
                {section.docs.slice(0, 3).map((doc) => (
                  <div key={doc} className="flex items-center text-xs text-gray-500 dark:text-gray-500">
                    <svg className="mr-2 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    {doc.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                ))}
                {section.docs.length > 3 && (
                  <div className="text-xs text-primary">
                    +{section.docs.length - 3} {t('documentation.moreGuides')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl bg-gradient-to-r from-primary/5 to-secondary/5 p-8 text-center">
          <h3 className="text-2xl font-bold text-dark dark:text-white">
            {t('documentation.cta.title')}
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-gray-600 dark:text-gray-400">
            {t('documentation.cta.description')}
          </p>
          
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/app/docs"
              className="inline-flex items-center rounded-lg bg-primary px-6 py-3 text-base font-medium text-white transition-colors hover:bg-primary/90"
            >
              {t('documentation.cta.browse')}
              <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </Link>
            
            <Link
              href="https://github.com/your-repo/nextjs-admin-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {t('documentation.cta.github')}
              <svg className="ml-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>

          {/* Quick links */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Link
              href="/app/docs/estrutura-geral"
              className="text-sm text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
            >
              📚 {t('documentation.quickLinks.structure')}
            </Link>
            <Link
              href="/app/docs/guia-desenvolvimento"
              className="text-sm text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
            >
              👨‍💻 {t('documentation.quickLinks.development')}
            </Link>
            <Link
              href="/app/docs/componentes"
              className="text-sm text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
            >
              🧩 {t('documentation.quickLinks.components')}
            </Link>
            <Link
              href="/app/docs/deploy"
              className="text-sm text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
            >
              🚀 {t('documentation.quickLinks.deploy')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}