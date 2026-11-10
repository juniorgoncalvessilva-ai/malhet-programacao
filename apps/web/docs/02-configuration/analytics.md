# Configuração de Analytics

Este documento explica como configurar e utilizar as integrações de analytics no AI Coders Starter Kit.

## Visão Geral

O sistema suporta quatro principais ferramentas de analytics e monitoramento:

- **Google Analytics** - Analytics de site e comportamento do usuário
- **Google Tag Manager** - Gerenciamento centralizado de tags
- **Meta Pixel** - Tracking para Facebook/Meta Ads
- **LogRocket** - Gravação de sessões e monitoramento de performance (apenas para usuários autenticados)

## Configuração de Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env.local`:

```bash
# Google Analytics
NEXT_PUBLIC_GA_ENABLED=true
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Google Tag Manager
NEXT_PUBLIC_GTM_ENABLED=true
NEXT_PUBLIC_GTM_CONTAINER_ID=GTM-XXXXXXX

# Meta Pixel
NEXT_PUBLIC_META_PIXEL_ENABLED=true
NEXT_PUBLIC_META_PIXEL_ID=XXXXXXXXXXXXXXX

# LogRocket
NEXT_PUBLIC_LOGROCKET_ENABLED=true
NEXT_PUBLIC_LOGROCKET_APP_ID=XXXXXX/XXXXXXX
NEXT_PUBLIC_APP_VERSION=1.2.1
```

## Estrutura da Configuração

### Interface AnalyticsConfig

```typescript
interface AnalyticsConfig {
  googleAnalytics?: {
    enabled: boolean;
    measurementId?: string;
    enableGtag?: boolean;
    enableDebug?: boolean;
    customEvents?: boolean;
  };
  googleTagManager?: {
    enabled: boolean;
    containerId?: string;
    enableDataLayer?: boolean;
    enableDebug?: boolean;
  };
  metaPixel?: {
    enabled: boolean;
    pixelId?: string;
    enableAdvancedMatching?: boolean;
    enableAutoConfig?: boolean;
    enableDebug?: boolean;
  };
  logRocket?: {
    enabled: boolean;
    appId?: string;
    enableConsole?: boolean;
    enableNetwork?: boolean;
    enableDOM?: boolean;
    enableCrashReporting?: boolean;
    enablePerformance?: boolean;
    release?: string;
    environment?: 'development' | 'staging' | 'production';
  };
}
```

### Configuração no app.ts

```typescript
analytics: {
  googleAnalytics: {
    enabled: process.env.NEXT_PUBLIC_GA_ENABLED === 'true',
    measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    enableGtag: true,
    enableDebug: process.env.NODE_ENV === 'development',
    customEvents: true
  },
  googleTagManager: {
    enabled: process.env.NEXT_PUBLIC_GTM_ENABLED === 'true',
    containerId: process.env.NEXT_PUBLIC_GTM_CONTAINER_ID,
    enableDataLayer: true,
    enableDebug: process.env.NODE_ENV === 'development'
  },
  metaPixel: {
    enabled: process.env.NEXT_PUBLIC_META_PIXEL_ENABLED === 'true',
    pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    enableAdvancedMatching: true,
    enableAutoConfig: true,
    enableDebug: process.env.NODE_ENV === 'development'
  },
  logRocket: {
    enabled: process.env.NEXT_PUBLIC_LOGROCKET_ENABLED === 'true',
    appId: process.env.NEXT_PUBLIC_LOGROCKET_APP_ID,
    enableConsole: true,
    enableNetwork: true,
    enableDOM: true,
    enableCrashReporting: true,
    enablePerformance: true,
    release: process.env.NEXT_PUBLIC_APP_VERSION || "1.2.1",
    environment: process.env.NODE_ENV || 'development'
  }
}
```

## Funções Helper Disponíveis

### Verificação de Status

```typescript
import { 
  isGoogleAnalyticsEnabled,
  isGoogleTagManagerEnabled,
  isMetaPixelEnabled,
  isLogRocketEnabled,
  isAnyAnalyticsEnabled 
} from '@/config';

// Verificar se cada serviço está habilitado
const gaEnabled = isGoogleAnalyticsEnabled();
const gtmEnabled = isGoogleTagManagerEnabled();
const pixelEnabled = isMetaPixelEnabled();
const lrEnabled = isLogRocketEnabled();

// Verificar se qualquer analytics está habilitado
const anyAnalytics = isAnyAnalyticsEnabled();
```

### Obtenção de IDs

```typescript
import { 
  getGoogleAnalyticsId,
  getGoogleTagManagerId,
  getMetaPixelId,
  getLogRocketAppId 
} from '@/config';

const gaId = getGoogleAnalyticsId(); // "G-XXXXXXXXXX"
const gtmId = getGoogleTagManagerId(); // "GTM-XXXXXXX"
const pixelId = getMetaPixelId(); // "XXXXXXXXXXXXXXX"
const lrAppId = getLogRocketAppId(); // "XXXXXX/XXXXXXX"
```

### Configuração Completa

```typescript
import { getAnalyticsConfig } from '@/config';

const analyticsConfig = getAnalyticsConfig();

// Acessar configurações específicas
const gaConfig = analyticsConfig.googleAnalytics;
const gtmConfig = analyticsConfig.googleTagManager;
const pixelConfig = analyticsConfig.metaPixel;
const lrConfig = analyticsConfig.logRocket;
```

## Uso em Componentes

### Componente de Analytics Provider

```typescript
'use client';

import { useEffect } from 'react';
import { 
  isGoogleAnalyticsEnabled,
  isGoogleTagManagerEnabled,
  isMetaPixelEnabled,
  isLogRocketEnabled,
  getGoogleAnalyticsId,
  getGoogleTagManagerId,
  getMetaPixelId,
  getLogRocketAppId 
} from '@/config';

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Inicializar Google Analytics
    if (isGoogleAnalyticsEnabled()) {
      const gaId = getGoogleAnalyticsId();
      if (gaId) {
        // Implementar inicialização do GA
        console.log('Initializing Google Analytics:', gaId);
      }
    }

    // Inicializar Google Tag Manager
    if (isGoogleTagManagerEnabled()) {
      const gtmId = getGoogleTagManagerId();
      if (gtmId) {
        // Implementar inicialização do GTM
        console.log('Initializing Google Tag Manager:', gtmId);
      }
    }

    // Inicializar Meta Pixel
    if (isMetaPixelEnabled()) {
      const pixelId = getMetaPixelId();
      if (pixelId) {
        // Implementar inicialização do Meta Pixel
        console.log('Initializing Meta Pixel:', pixelId);
      }
    }

    // Inicializar LogRocket (apenas para usuários autenticados)
    if (isLogRocketEnabled() && user) {
      const appId = getLogRocketAppId();
      if (appId) {
        // Implementar inicialização do LogRocket
        console.log('Initializing LogRocket for authenticated user:', appId);
      }
    }
  }, []);

  return <>{children}</>;
}
```

### Hook Personalizado para Analytics

```typescript
'use client';

import { useCallback } from 'react';
import { 
  isGoogleAnalyticsEnabled,
  isMetaPixelEnabled,
  getAnalyticsConfig 
} from '@/config';

export function useAnalytics() {
  const config = getAnalyticsConfig();

  const trackEvent = useCallback((eventName: string, properties?: Record<string, any>) => {
    // Google Analytics
    if (isGoogleAnalyticsEnabled() && window.gtag) {
      window.gtag('event', eventName, properties);
    }

    // Meta Pixel
    if (isMetaPixelEnabled() && window.fbq) {
      window.fbq('track', eventName, properties);
    }

    // LogRocket (eventos customizados - apenas para usuários autenticados)
    if (window.LogRocket && user) {
      window.LogRocket.track(eventName, properties);
    }
  }, []);

  const trackPageView = useCallback((path: string) => {
    // Google Analytics
    if (isGoogleAnalyticsEnabled() && window.gtag) {
      window.gtag('config', config.googleAnalytics?.measurementId, {
        page_path: path,
      });
    }

    // Meta Pixel
    if (isMetaPixelEnabled() && window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [config]);

  return {
    trackEvent,
    trackPageView,
    isEnabled: {
      ga: isGoogleAnalyticsEnabled(),
      gtm: isGoogleTagManagerEnabled(),
      pixel: isMetaPixelEnabled(),
      logRocket: isLogRocketEnabled(),
    }
  };
}
```

### Uso do Hook

```typescript
import { useAnalytics } from '@/hooks/useAnalytics';

function ProductPage() {
  const { trackEvent, trackPageView } = useAnalytics();

  useEffect(() => {
    trackPageView('/product');
  }, [trackPageView]);

  const handleAddToCart = () => {
    trackEvent('add_to_cart', {
      item_id: 'product_123',
      item_name: 'Product Name',
      value: 29.99,
      currency: 'BRL'
    });
  };

  return (
    <div>
      <h1>Product Page</h1>
      <button onClick={handleAddToCart}>
        Add to Cart
      </button>
    </div>
  );
}
```

## Configuração por Ambiente

### Desenvolvimento

```bash
# .env.local (desenvolvimento)
NEXT_PUBLIC_GA_ENABLED=false
NEXT_PUBLIC_GTM_ENABLED=false
NEXT_PUBLIC_META_PIXEL_ENABLED=false
NEXT_PUBLIC_LOGROCKET_ENABLED=true
```

### Produção

```bash
# .env.production (produção)
NEXT_PUBLIC_GA_ENABLED=true
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-REAL-ID-HERE
NEXT_PUBLIC_GTM_ENABLED=true
NEXT_PUBLIC_GTM_CONTAINER_ID=GTM-REAL-ID
NEXT_PUBLIC_META_PIXEL_ENABLED=true
NEXT_PUBLIC_META_PIXEL_ID=REAL-PIXEL-ID
NEXT_PUBLIC_LOGROCKET_ENABLED=true
NEXT_PUBLIC_LOGROCKET_APP_ID=REAL-APP-ID
```

## Implementação Completa

### 1. Script Tags no Head

```typescript
// app/layout.tsx
import Script from 'next/script';
import { 
  isGoogleAnalyticsEnabled,
  isGoogleTagManagerEnabled,
  getGoogleAnalyticsId,
  getGoogleTagManagerId 
} from '@/config';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        {/* Google Analytics */}
        {isGoogleAnalyticsEnabled() && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${getGoogleAnalyticsId()}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${getGoogleAnalyticsId()}');
              `}
            </Script>
          </>
        )}

        {/* Google Tag Manager */}
        {isGoogleTagManagerEnabled() && (
          <Script id="google-tag-manager" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${getGoogleTagManagerId()}');
            `}
          </Script>
        )}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
```

### 2. Provider no App

**O AnalyticsProvider está implementado e integrado!**

```typescript
// app/providers.tsx
import AnalyticsProvider from '@/providers/analytics-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <QueryClientProvider client={queryClient}>
        <AnalyticsProvider>
          <ThemeProvider defaultTheme="light" attribute="class">
            <ZustandProvider>
              <SidebarProvider>
                {children}
                <ToastProvider />
              </SidebarProvider>
            </ZustandProvider>
          </ThemeProvider>
        </AnalyticsProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
```

## Troubleshooting

### Problema: Analytics não carrega

**Verificações:**
1. Confirme que as variáveis de ambiente estão definidas
2. Verifique se os IDs estão corretos
3. Confirme que o ambiente de produção está configurado

### Problema: Debug mode não funciona

**Solução:** Verifique se `NODE_ENV` está definido corretamente:

```typescript
const isDebug = process.env.NODE_ENV === 'development';
```

### Problema: TypeScript errors

**Solução:** Adicione tipagens globais para as ferramentas:

```typescript
// types/global.d.ts
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    fbq: (...args: any[]) => void;
    LogRocket: {
      track: (event: string, properties?: Record<string, any>) => void;
      identify: (userId: string, userInfo?: Record<string, any>) => void;
    };
  }
}
```

## Exemplos de Eventos Customizados

### E-commerce

```typescript
// Produto visualizado
trackEvent('view_item', {
  item_id: 'SKU123',
  item_name: 'Product Name',
  category: 'Electronics',
  value: 99.99,
  currency: 'BRL'
});

// Compra realizada
trackEvent('purchase', {
  transaction_id: 'T12345',
  value: 199.98,
  currency: 'BRL',
  items: [
    {
      item_id: 'SKU123',
      item_name: 'Product 1',
      quantity: 1,
      price: 99.99
    }
  ]
});
```

### Engajamento

```typescript
// Formulário enviado
trackEvent('form_submit', {
  form_name: 'contact_form',
  form_location: 'footer'
});

// Download de arquivo
trackEvent('file_download', {
  file_name: 'manual.pdf',
  file_type: 'pdf',
  file_size: '2.5MB'
});
```

## Compliance e Privacidade

### LGPD/GDPR

```typescript
// Implementar consentimento de cookies
const [hasConsent, setHasConsent] = useState(false);

useEffect(() => {
  if (hasConsent) {
    // Inicializar analytics apenas após consentimento
    initializeAnalytics();
  }
}, [hasConsent]);
```

### Anonimização de Dados

```typescript
// Google Analytics com IP anonimizado
gtag('config', gaId, {
  anonymize_ip: true,
  allow_google_signals: false,
  allow_ad_personalization_signals: false
});
```

O sistema de analytics oferece flexibilidade completa para monitorar o comportamento dos usuários respeitando as configurações de privacidade e compliance necessárias.