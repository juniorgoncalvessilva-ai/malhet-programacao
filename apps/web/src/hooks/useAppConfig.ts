import { useMemo } from 'react';
import { 
  appConfig, 
  getAppName, 
  getAppVersion, 
  getCompanyName, 
  getSocialLinks, 
  getContactEmail,
  getLogoConfig,
  getThemeConfig,
  getFeatureFlags,
  getSEOConfig,
  isFeatureEnabled,
  getSocialLink
} from '@/config';
import type { FeatureFlags } from '@/config';

/**
 * Hook personalizado para acessar configurações da aplicação
 * Fornece uma interface reativa para as configurações centrais
 */
export function useAppConfig() {
  const config = useMemo(() => ({
    // Informações básicas
    app: {
      name: getAppName(),
      version: getAppVersion(),
      description: appConfig.app.description,
      url: appConfig.app.url,
      locale: appConfig.app.locale,
      timezone: appConfig.app.timezone
    },

    // Informações da empresa
    company: {
      name: getCompanyName(),
      legalName: appConfig.company.legalName,
      description: appConfig.company.description,
      tagline: appConfig.company.tagline,
      founded: appConfig.company.founded,
      address: appConfig.company.address
    },

    // Contato
    contact: {
      email: getContactEmail(),
      phone: appConfig.contact.phone,
      website: appConfig.contact.website
    },

    // Logo e branding
    logo: getLogoConfig(),

    // Redes sociais
    social: getSocialLinks(),

    // Tema
    theme: getThemeConfig(),

    // Features
    features: getFeatureFlags(),

    // SEO
    seo: getSEOConfig(),

    // URLs importantes
    urls: appConfig.urls,

    // Configurações de desenvolvimento
    development: appConfig.development
  }), []);

  // Helpers
  const helpers = useMemo(() => ({
    isFeatureEnabled: (feature: keyof FeatureFlags) => isFeatureEnabled(feature),
    getSocialLink: (name: string) => getSocialLink(name),
    isMaintenanceMode: () => appConfig.features.maintenanceMode,
    isDevelopment: () => appConfig.development.showDebugInfo,
    getFullUrl: (path: string = '') => {
      const baseUrl = appConfig.app.url;
      return path ? `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}` : baseUrl;
    }
  }), []);

  return {
    ...config,
    ...helpers
  };
}

/**
 * Hook para verificar features específicas
 */
export function useFeature(feature: keyof FeatureFlags) {
  return useMemo(() => isFeatureEnabled(feature), [feature]);
}

/**
 * Hook para informações de branding/tema
 */
export function useBranding() {
  return useMemo(() => ({
    appName: getAppName(),
    companyName: getCompanyName(),
    logo: getLogoConfig(),
    theme: getThemeConfig(),
    colors: {
      primary: appConfig.theme.primaryColor,
      secondary: appConfig.theme.secondaryColor,
      accent: appConfig.theme.accentColor,
      danger: appConfig.theme.dangerColor,
      success: appConfig.theme.successColor,
      warning: appConfig.theme.warningColor,
      info: appConfig.theme.infoColor
    }
  }), []);
}

/**
 * Hook para informações de contato e social
 */
export function useContactInfo() {
  return useMemo(() => ({
    email: getContactEmail(),
    phone: appConfig.contact.phone,
    website: appConfig.contact.website,
    social: getSocialLinks(),
    address: appConfig.company.address
  }), []);
}

/**
 * Hook para configurações de desenvolvimento
 */
export function useDevConfig() {
  return useMemo(() => ({
    isDev: process.env.NODE_ENV === 'development',
    showDebugInfo: appConfig.development.showDebugInfo,
    enableHotReload: appConfig.development.enableHotReload,
    logLevel: appConfig.development.logLevel,
    isMaintenanceMode: appConfig.features.maintenanceMode
  }), []);
}