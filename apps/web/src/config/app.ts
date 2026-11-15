/**
 * Configuração Central da Aplicação
 * 
 * Este arquivo contém todas as informações centrais da aplicação,
 * incluindo nome, descrição, links sociais, configurações e metadados.
 */

import { type IconType } from "react-icons";

// Tipos TypeScript para configuração
export interface SocialLink {
  name: string;
  url: string;
  icon: IconType;
  color?: string;
  username?: string;
}

export interface ContactInfo {
  email: string;
  phone?: string;
  address?: string;
  website?: string;
}

export interface CompanyInfo {
  name: string;
  legalName?: string;
  description: string;
  tagline?: string;
  founded?: string;
  cnpj?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export interface LogoConfig {
  main: string;          // Logo principal
  dark?: string;         // Logo para modo escuro
  icon: string;          // Ícone pequeno/favicon
  favicon?: string;      // Favicon específico
  sizes?: {
    small?: string;      // Logo pequeno
    medium?: string;     // Logo médio
    large?: string;      // Logo grande
  };
}

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  dangerColor: string;
  successColor: string;
  warningColor: string;
  infoColor: string;
  defaultTheme: 'light' | 'dark' | 'system';
  enableThemeToggle: boolean;
}

export interface AnalyticsConfig {
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
    enableDebug?: boolean;
    release?: string;
    environment?: 'development' | 'staging' | 'production';
  };
}

export interface FeatureFlags {
  enableAuth: boolean;
  enableI18n: boolean;
  enableDarkMode: boolean;
  enableFormValidation: boolean;
  enableCepLookup: boolean;
  enableAnalytics: boolean;
  maintenanceMode: boolean;
}

export interface SEOConfig {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  canonicalUrl?: string;
}

export interface AppConfig {
  // Informações básicas da aplicação
  app: {
    name: string;
    version: string;
    description: string;
    tagline: string;
    url: string;
    locale: string;
    timezone: string;
  };

  // Informações da empresa/organização
  company: CompanyInfo;

  // Configuração de logos
  logo: LogoConfig;

  // Links sociais
  social: SocialLink[];

  // Informações de contato
  contact: ContactInfo;

  // Configuração de tema
  theme: ThemeConfig;

  // Feature flags
  features: FeatureFlags;

  // Configuração SEO
  seo: SEOConfig;

  // Configuração de analytics
  analytics: AnalyticsConfig;

  // URLs importantes
  urls: {
    docs: string;
    support: string;
    privacy: string;
    terms: string;
    blog?: string;
    status?: string;
  };

  // Configurações de desenvolvimento
  development: {
    showDebugInfo: boolean;
    enableHotReload: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

// Configuração principal da aplicação
export const appConfig: AppConfig = {
  app: {
    name: "Malhet",
    version: "1.2.1",
    description: "Malhet · Gestão da execução de obras",
    tagline: "O que foi decidido, fica.",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo"
  },

  company: {
    name: "Malhet",
    legalName: "Malhet",
    description: "Gestão da execução de obras: o que acontece na obra, quem decidiu e quanto custou.",
    tagline: "O que foi decidido, fica.",
    founded: "2026",
    address: {
      street: "Rua das Inovações, 123",
      city: "São Paulo",
      state: "SP",
      zipCode: "01310-100",
      country: "Brasil"
    }
  },

  logo: {
    main: "/images/logo/logo.svg",
    dark: "/images/logo/logo-dark.svg",
    icon: "/images/logo/logo-icon.svg",
    favicon: "/brand/favicon.svg",
    sizes: {
      small: "/images/logo/logo-icon.svg",
      medium: "/images/logo/logo.svg",
      large: "/images/logo/logo.svg"
    }
  },

  social: [],

  contact: {
    email: "",
    phone: "",
    website: "https://malhet.com"
  },

  theme: {
    primaryColor: "#3b82f6",      // blue-500
    secondaryColor: "#64748b",     // slate-500
    accentColor: "#8b5cf6",       // violet-500
    dangerColor: "#ef4444",       // red-500
    successColor: "#10b981",      // emerald-500
    warningColor: "#f59e0b",      // amber-500
    infoColor: "#06b6d4",         // cyan-500
    defaultTheme: "system",
    enableThemeToggle: true
  },

  features: {
    enableAuth: true,
    enableI18n: true,
    enableDarkMode: true,
    enableFormValidation: true,
    enableCepLookup: true,
    enableAnalytics: false,
    maintenanceMode: false
  },

  seo: {
    title: "Malhet · Gestão da execução de obras",
    description: "O Malhet registra o que acontece na obra, quem decidiu e quanto custou, para que nenhuma decisão se perca.",
    keywords: ["gestão de obras", "programação de obra", "RDO", "PPC", "restrições", "efetivo", "segurança do trabalho", "Malhet"],
    ogImage: "/images/og-image.png",
    twitterCard: "summary_large_image"
  },

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
      enableDebug: process.env.NODE_ENV === 'development',
      release: process.env.NEXT_PUBLIC_APP_VERSION || "1.2.1",
      environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development'
    }
  },

  urls: {
    docs: "/docs",
    support: "/privacidade",
    privacy: "/privacidade",
    terms: "/privacidade",
    blog: "/",
    status: "/"
  },

  development: {
    showDebugInfo: process.env.NODE_ENV === "development",
    enableHotReload: process.env.NODE_ENV === "development",
    logLevel: process.env.NODE_ENV === "development" ? "debug" : "error"
  }
};

// Helpers para acessar configurações específicas
export const getAppName = () => appConfig.app.name;
export const getAppVersion = () => appConfig.app.version;
export const getAppDescription = () => appConfig.app.description;
export const getCompanyName = () => appConfig.company.name;
export const getContactEmail = () => appConfig.contact.email;
export const getSocialLinks = () => appConfig.social;
export const getLogoConfig = () => appConfig.logo;
export const getThemeConfig = () => appConfig.theme;
export const getFeatureFlags = () => appConfig.features;
export const getSEOConfig = () => appConfig.seo;
export const getAnalyticsConfig = () => appConfig.analytics;

// Helper para verificar se uma feature está habilitada
export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
  return appConfig.features[feature];
};

// Helper para obter links sociais por nome
export const getSocialLink = (name: string): SocialLink | undefined => {
  return appConfig.social.find(link => link.name.toLowerCase() === name.toLowerCase());
};

// Helper para obter URL completa
export const getFullUrl = (path: string = ""): string => {
  const baseUrl = appConfig.app.url;
  return path ? `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}` : baseUrl;
};

// Helper para modo de manutenção
export const isMaintenanceMode = (): boolean => {
  return appConfig.features.maintenanceMode;
};

// Helpers para analytics
export const isGoogleAnalyticsEnabled = (): boolean => {
  return appConfig.analytics.googleAnalytics?.enabled || false;
};

export const isGoogleTagManagerEnabled = (): boolean => {
  return appConfig.analytics.googleTagManager?.enabled || false;
};

export const isMetaPixelEnabled = (): boolean => {
  return appConfig.analytics.metaPixel?.enabled || false;
};

export const isLogRocketEnabled = (): boolean => {
  return appConfig.analytics.logRocket?.enabled || false;
};

export const getGoogleAnalyticsId = (): string | undefined => {
  return appConfig.analytics.googleAnalytics?.measurementId;
};

export const getGoogleTagManagerId = (): string | undefined => {
  return appConfig.analytics.googleTagManager?.containerId;
};

export const getMetaPixelId = (): string | undefined => {
  return appConfig.analytics.metaPixel?.pixelId;
};

export const getLogRocketAppId = (): string | undefined => {
  return appConfig.analytics.logRocket?.appId;
};

export const isAnyAnalyticsEnabled = (): boolean => {
  return isGoogleAnalyticsEnabled() || 
         isGoogleTagManagerEnabled() || 
         isMetaPixelEnabled() || 
         isLogRocketEnabled();
};

// Export default da configuração
export default appConfig;