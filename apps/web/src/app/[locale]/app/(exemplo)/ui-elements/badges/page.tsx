"use client";

import { Badge } from "@/components/ui/badge";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { CheckIcon, AlertTriangleIcon, XCircleIcon, InfoIcon } from "lucide-react";
import { useState } from "react";
import { useTranslations } from 'next-intl';

export default function BadgesPage() {
  const [removableBadges, setRemovableBadges] = useState([
    "React", "TypeScript", "Tailwind", "Next.js"
  ]);
  const t = useTranslations('UIElements');
  const tBadge = useTranslations('Badge');

  const handleRemove = (index: number) => {
    setRemovableBadges(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      <Breadcrumb pageName={t('badges')} />

      <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-9">
        
        {/* Variantes */}
        <div className="mb-8">
          <h3 className="mb-4 text-xl font-semibold text-dark dark:text-white">
            {t('variants')}
          </h3>
          <div className="flex flex-wrap gap-3">
            <Badge>{tBadge('default')}</Badge>
            <Badge variant="primary">{tBadge('primary')}</Badge>
            <Badge variant="success">{tBadge('success')}</Badge>
            <Badge variant="warning">{tBadge('warning')}</Badge>
            <Badge variant="error">{tBadge('error')}</Badge>
            <Badge variant="info">{tBadge('info')}</Badge>
          </div>
        </div>

        {/* Tamanhos */}
        <div className="mb-8">
          <h3 className="mb-4 text-xl font-semibold text-dark dark:text-white">
            {t('sizes')}
          </h3>
          <div className="flex items-center gap-3">
            <Badge size="sm" variant="primary">{tBadge('small')}</Badge>
            <Badge size="md" variant="primary">{tBadge('medium')}</Badge>
            <Badge size="lg" variant="primary">{tBadge('large')}</Badge>
          </div>
        </div>

        {/* Com Ícones */}
        <div className="mb-8">
          <h3 className="mb-4 text-xl font-semibold text-dark dark:text-white">
            {t('withIcons')}
          </h3>
          <div className="flex flex-wrap gap-3">
            <Badge icon={<CheckIcon />} variant="success">
              {tBadge('verified')}
            </Badge>
            <Badge icon={<AlertTriangleIcon />} variant="warning">
              {tBadge('attention')}
            </Badge>
            <Badge icon={<XCircleIcon />} variant="error">
              {tBadge('error')}
            </Badge>
            <Badge icon={<InfoIcon />} variant="info">
              {tBadge('info')}
            </Badge>
          </div>
        </div>

        {/* Badges Dot */}
        <div className="mb-8">
          <h3 className="mb-4 text-xl font-semibold text-dark dark:text-white">
            {t('notificationBadges')}
          </h3>
          <div className="flex items-center gap-3">
            <Badge dot variant="primary">3</Badge>
            <Badge dot variant="error">!</Badge>
            <Badge dot variant="success">✓</Badge>
            <Badge dot variant="warning">99+</Badge>
          </div>
        </div>

        {/* Badges Removíveis */}
        <div className="mb-8">
          <h3 className="mb-4 text-xl font-semibold text-dark dark:text-white">
            {t('removable')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {removableBadges.map((tech, index) => (
              <Badge
                key={tech}
                variant="primary"
                removable
                onRemove={() => handleRemove(index)}
              >
                {tech}
              </Badge>
            ))}
          </div>
          {removableBadges.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tBadge('allRemoved')}
            </p>
          )}
        </div>

        {/* Casos de Uso */}
        <div className="mb-8">
          <h3 className="mb-4 text-xl font-semibold text-dark dark:text-white">
            {t('useCases')}
          </h3>
          <div className="space-y-4">
            {/* Status */}
            <div>
              <h4 className="mb-2 font-medium text-dark dark:text-white">{tBadge('status')}</h4>
              <div className="flex gap-2">
                <Badge variant="success">{tBadge('active')}</Badge>
                <Badge variant="warning">{tBadge('pending')}</Badge>
                <Badge variant="error">{tBadge('inactive')}</Badge>
              </div>
            </div>

            {/* Categorias */}
            <div>
              <h4 className="mb-2 font-medium text-dark dark:text-white">{tBadge('categories')}</h4>
              <div className="flex flex-wrap gap-2">
                <Badge>{tBadge('frontend')}</Badge>
                <Badge>{tBadge('backend')}</Badge>
                <Badge>{tBadge('devops')}</Badge>
                <Badge>{tBadge('mobile')}</Badge>
              </div>
            </div>

            {/* Notificações */}
            <div>
              <h4 className="mb-2 font-medium text-dark dark:text-white">{tBadge('notifications')}</h4>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <span className="text-dark dark:text-white">{tBadge('messages')}</span>
                  <Badge dot variant="error" className="absolute -top-2 -right-2">
                    5
                  </Badge>
                </div>
                <div className="relative">
                  <span className="text-dark dark:text-white">{tBadge('notifications')}</span>
                  <Badge dot variant="primary" className="absolute -top-2 -right-2">
                    12
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Código de Exemplo */}
        <div>
          <h3 className="mb-4 text-xl font-semibold text-dark dark:text-white">
            {t('codeExample')}
          </h3>
          <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <pre className="text-sm text-gray-800 dark:text-gray-200">
{`// Badge básico
<Badge>Novo</Badge>

// Badge com variante
<Badge variant="success">Aprovado</Badge>

// Badge removível
<Badge removable onRemove={() => handleRemove()}>
  Removível
</Badge>

// Badge com ícone
<Badge icon={<CheckIcon />} variant="success">
  Verificado
</Badge>`}
            </pre>
          </div>
        </div>

      </div>
    </>
  );
}