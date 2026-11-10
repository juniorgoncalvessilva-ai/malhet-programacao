'use client';

import { useEffect } from 'react';
import { useAnalytics, useLogRocketSession } from '@/providers/analytics-provider';
import { Button } from '@/components/ui/Button';

/**
 * Componente de exemplo mostrando como usar o AnalyticsProvider
 * Este componente demonstra várias funcionalidades de tracking
 */
export default function AnalyticsExample() {
  const { 
    trackEvent, 
    trackPageView, 
    trackUserAction, 
    trackError, 
    trackFormSubmission,
    trackFileDownload,
    isEnabled 
  } = useAnalytics();

  const { getSessionURL } = useLogRocketSession();

  // Track page view no mount
  useEffect(() => {
    trackPageView('/analytics-example', 'Analytics Example Page');
  }, [trackPageView]);

  const handleButtonClick = () => {
    trackUserAction('button_click', 'engagement', 'analytics_example_button');
  };

  const handleTrackCustomEvent = () => {
    trackEvent('custom_event', {
      event_category: 'user_interaction',
      event_label: 'custom_analytics_test',
      value: 1,
      custom_parameter: 'test_value'
    });
  };

  const handleTrackError = () => {
    trackError('Test error message', 'testing');
  };

  const handleFormSubmit = () => {
    trackFormSubmission('analytics_test_form', true);
  };

  const handleFileDownload = () => {
    trackFileDownload('analytics_guide.pdf', 'pdf', '2.5MB');
  };

  const handleGetLogRocketSession = () => {
    if (isEnabled.logRocket) {
      const sessionURL = getSessionURL();
      if (sessionURL) {
        alert(`LogRocket Session URL: ${sessionURL}`);
      } else {
        alert('LogRocket session not available');
      }
    } else {
      alert('LogRocket is not enabled');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Analytics Provider - Exemplo de Uso</h1>
      
      {/* Status dos Analytics */}
      <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Status dos Analytics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isEnabled.ga ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>Google Analytics</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isEnabled.gtm ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>Google Tag Manager</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isEnabled.pixel ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>Meta Pixel</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isEnabled.logRocket ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>LogRocket</span>
          </div>
        </div>
      </div>

      {/* Botões de exemplo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Button 
          onClick={handleButtonClick}
          className="h-auto p-4 flex flex-col items-center space-y-2"
        >
          <span className="font-semibold">Track User Action</span>
          <span className="text-sm opacity-80">Rastrear ação do usuário</span>
        </Button>

        <Button 
          onClick={handleTrackCustomEvent}
          variant="outlinePrimary"
          className="h-auto p-4 flex flex-col items-center space-y-2"
        >
          <span className="font-semibold">Custom Event</span>
          <span className="text-sm opacity-80">Evento personalizado</span>
        </Button>

        <Button 
          onClick={handleTrackError}
          variant="outlineDark"
          className="h-auto p-4 flex flex-col items-center space-y-2 !border-red-500 !text-red-500 hover:!bg-red-50"
        >
          <span className="font-semibold">Track Error</span>
          <span className="text-sm opacity-80">Rastrear erro</span>
        </Button>

        <Button 
          onClick={handleFormSubmit}
          variant="green"
          className="h-auto p-4 flex flex-col items-center space-y-2"
        >
          <span className="font-semibold">Form Submission</span>
          <span className="text-sm opacity-80">Envio de formulário</span>
        </Button>

        <Button 
          onClick={handleFileDownload}
          variant="outlinePrimary"
          className="h-auto p-4 flex flex-col items-center space-y-2"
        >
          <span className="font-semibold">File Download</span>
          <span className="text-sm opacity-80">Download de arquivo</span>
        </Button>

        <Button 
          onClick={handleGetLogRocketSession}
          variant="outlineDark"
          className="h-auto p-4 flex flex-col items-center space-y-2"
          disabled={!isEnabled.logRocket}
        >
          <span className="font-semibold">LogRocket Session</span>
          <span className="text-sm opacity-80">URL da sessão</span>
        </Button>
      </div>

      {/* Informações técnicas */}
      <div className="space-y-6">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
            📊 Como funciona
          </h3>
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            Cada botão demonstra uma funcionalidade diferente do sistema de analytics. 
            Os eventos são enviados automaticamente para todas as plataformas habilitadas.
          </p>
        </div>

        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
            🔧 Configuração
          </h3>
          <p className="text-green-700 dark:text-green-300 text-sm">
            Configure as variáveis de ambiente (.env.local) para habilitar cada plataforma:
            NEXT_PUBLIC_GA_ENABLED, NEXT_PUBLIC_GTM_ENABLED, NEXT_PUBLIC_META_PIXEL_ENABLED, NEXT_PUBLIC_LOGROCKET_ENABLED
          </p>
        </div>

        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
            🚀 Desenvolvimento
          </h3>
          <p className="text-purple-700 dark:text-purple-300 text-sm">
            Em modo de desenvolvimento, todos os eventos são logados no console para debugging. 
            Abra o DevTools para ver os eventos sendo disparados.
          </p>
        </div>
      </div>

      {/* Código de exemplo */}
      <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h3 className="font-semibold mb-2">Exemplo de código:</h3>
        <pre className="text-sm overflow-x-auto">
{`import { useAnalytics } from '@/providers/analytics-provider';

const { trackEvent, isEnabled } = useAnalytics();

// Rastrear evento personalizado
trackEvent('button_click', {
  event_category: 'engagement',
  event_label: 'hero_cta',
  value: 1
});`}
        </pre>
      </div>
    </div>
  );
}