'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { useUser } from '@clerk/nextjs';
import { 
  isGoogleAnalyticsEnabled,
  isGoogleTagManagerEnabled,
  isMetaPixelEnabled,
  isLogRocketEnabled,
  getGoogleAnalyticsId,
  getGoogleTagManagerId,
  getMetaPixelId,
  getLogRocketAppId,
  getAnalyticsConfig
} from '@/config';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
    fbq: (...args: any[]) => void;
    LogRocket: {
      init: (appId: string, options?: any) => void;
      identify: (userId: string, userInfo?: Record<string, any>) => void;
      track: (event: string, properties?: Record<string, any>) => void;
      getSessionURL: () => string;
      captureMessage: (message: string) => void;
    };
  }
}

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

export default function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const { user, isLoaded } = useUser();
  const analyticsConfig = getAnalyticsConfig();

  // Initialize Google Analytics
  useEffect(() => {
    if (isGoogleAnalyticsEnabled()) {
      const measurementId = getGoogleAnalyticsId();
      if (measurementId && typeof window !== 'undefined' && window.gtag) {
        window.gtag('config', measurementId, {
          page_title: document.title,
          page_location: window.location.href,
          custom_map: {
            app_name: 'AI Coders Starter Kit',
            app_version: '1.2.1'
          }
        });

        if (analyticsConfig.googleAnalytics?.enableDebug && process.env.NODE_ENV === 'development') {
          console.log('🔍 Google Analytics initialized:', measurementId);
        }
      }
    }
  }, [analyticsConfig.googleAnalytics?.enableDebug]);

  // Initialize Meta Pixel
  useEffect(() => {
    if (isMetaPixelEnabled()) {
      const pixelId = getMetaPixelId();
      if (pixelId && typeof window !== 'undefined' && window.fbq) {
        window.fbq('init', pixelId, {
          em: user?.emailAddresses?.[0]?.emailAddress || undefined
        });
        window.fbq('track', 'PageView');

        if (analyticsConfig.metaPixel?.enableDebug && process.env.NODE_ENV === 'development') {
          console.log('🔍 Meta Pixel initialized:', pixelId);
        }
      }
    }
  }, [user?.emailAddresses, analyticsConfig.metaPixel?.enableDebug]);

  // Initialize LogRocket only for authenticated users
  useEffect(() => {
    if (isLogRocketEnabled() && isLoaded && user) {
      const appId = getLogRocketAppId();
      if (appId && typeof window !== 'undefined') {
        // Dynamically load LogRocket
        import('logrocket').then((LogRocket) => {
          LogRocket.default.init(appId, {
            console: {
              isEnabled: analyticsConfig.logRocket?.enableConsole ?? true
            },
            network: {
              isEnabled: analyticsConfig.logRocket?.enableNetwork ?? true
            },
            dom: {
              isEnabled: analyticsConfig.logRocket?.enableDOM ?? true
            },
            release: analyticsConfig.logRocket?.release || '1.2.1',
            shouldCaptureIP: false, // LGPD compliance
          });

          // Identify user when available
          if (isLoaded && user) {
            LogRocket.default.identify(user.id, {
              name: user.fullName || 'Unknown',
              email: user.emailAddresses?.[0]?.emailAddress,
              // Don't send sensitive data
            });
          }

          if (analyticsConfig.logRocket?.enableDebug && process.env.NODE_ENV === 'development') {
            console.log('🔍 LogRocket initialized for authenticated user:', appId);
          }
        }).catch((error) => {
          console.error('Failed to load LogRocket:', error);
        });
      }
    }
  }, [isLoaded, user, analyticsConfig.logRocket?.enableDebug, analyticsConfig.logRocket?.enableConsole, analyticsConfig.logRocket?.enableNetwork, analyticsConfig.logRocket?.enableDOM, analyticsConfig.logRocket?.release]);

  // Track user identification for analytics
  useEffect(() => {
    if (isLoaded && user) {
      // Google Analytics user identification
      if (isGoogleAnalyticsEnabled() && window.gtag) {
        window.gtag('config', getGoogleAnalyticsId()!, {
          user_id: user.id,
          custom_map: {
            user_name: user.fullName || 'Unknown'
          }
        });
      }

      // Meta Pixel user identification
      if (isMetaPixelEnabled() && window.fbq) {
        window.fbq('track', 'CompleteRegistration', {
          content_name: 'User Login',
          value: 1,
          currency: 'BRL'
        });
      }
    }
  }, [isLoaded, user]);

  return (
    <>
      {/* Google Analytics Scripts */}
      {isGoogleAnalyticsEnabled() && getGoogleAnalyticsId() && (
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
              
              gtag('config', '${getGoogleAnalyticsId()}', {
                page_title: document.title,
                page_location: window.location.href,
                anonymize_ip: true,
                allow_google_signals: false,
                allow_ad_personalization_signals: false
              });
            `}
          </Script>
        </>
      )}

      {/* Google Tag Manager Scripts */}
      {isGoogleTagManagerEnabled() && getGoogleTagManagerId() && (
        <>
          <Script id="google-tag-manager" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${getGoogleTagManagerId()}');
            `}
          </Script>
          {/* GTM noscript fallback */}
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${getGoogleTagManagerId()}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        </>
      )}

      {/* Meta Pixel Scripts */}
      {isMetaPixelEnabled() && getMetaPixelId() && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            
            fbq('init', '${getMetaPixelId()}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {children}
    </>
  );
}

// Hook para usar analytics
export function useAnalytics() {
  const { user, isLoaded } = useUser();
  const config = getAnalyticsConfig();

  const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    // Google Analytics
    if (isGoogleAnalyticsEnabled() && typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, {
        ...properties,
        app_name: 'AI Coders Starter Kit',
        timestamp: new Date().toISOString()
      });
    }

    // Meta Pixel
    if (isMetaPixelEnabled() && typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', eventName, properties);
    }

    // LogRocket (only for authenticated users)
    if (isLogRocketEnabled() && isLoaded && user && typeof window !== 'undefined' && window.LogRocket) {
      window.LogRocket.track(eventName, properties);
    }

    // Debug log
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Analytics Event:', eventName, properties);
    }
  };

  const trackPageView = (path: string, title?: string) => {
    // Google Analytics
    if (isGoogleAnalyticsEnabled() && typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', config.googleAnalytics?.measurementId!, {
        page_path: path,
        page_title: title || document.title,
        page_location: window.location.href
      });
    }

    // Meta Pixel
    if (isMetaPixelEnabled() && typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView');
    }

    // Debug log
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Page View:', path, title);
    }
  };

  const trackUserAction = (action: string, category: string, label?: string, value?: number) => {
    trackEvent('user_action', {
      event_category: category,
      event_label: label,
      value: value,
      action: action
    });
  };

  const trackError = (error: string, category: string = 'error') => {
    trackEvent('error', {
      event_category: category,
      error_message: error,
      timestamp: new Date().toISOString()
    });

    // LogRocket specific error tracking (only for authenticated users)
    if (isLogRocketEnabled() && isLoaded && user && typeof window !== 'undefined' && window.LogRocket) {
      window.LogRocket.captureMessage(error);
    }
  };

  const trackFormSubmission = (formName: string, success: boolean = true) => {
    trackEvent('form_submit', {
      form_name: formName,
      success: success,
      event_category: 'engagement'
    });
  };

  const trackFileDownload = (fileName: string, fileType: string, fileSize?: string) => {
    trackEvent('file_download', {
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      event_category: 'engagement'
    });
  };

  return {
    trackEvent,
    trackPageView,
    trackUserAction,
    trackError,
    trackFormSubmission,
    trackFileDownload,
    isEnabled: {
      ga: isGoogleAnalyticsEnabled(),
      gtm: isGoogleTagManagerEnabled(),
      pixel: isMetaPixelEnabled(),
      logRocket: isLogRocketEnabled() && isLoaded && !!user,
    }
  };
}

// Hook para obter URL da sessão LogRocket
export function useLogRocketSession() {
  const { user, isLoaded } = useUser();
  
  const getSessionURL = () => {
    if (isLogRocketEnabled() && isLoaded && user && typeof window !== 'undefined' && window.LogRocket) {
      return window.LogRocket.getSessionURL();
    }
    return null;
  };

  return { getSessionURL };
}