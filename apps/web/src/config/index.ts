/**
 * Configurações Centralizadas da Aplicação
 * 
 * Este arquivo centraliza todas as configurações, constantes e helpers
 * utilizados na aplicação.
 */

// Export das configurações principais
export { default as appConfig } from './app';
export * from './app';

// Export das constantes
export * from './constants';

// Export dos dados de demonstração
export * from './demo-data';

// Re-exports organizados por categoria
export {
  // Helpers de configuração da app
  getAppName,
  getAppVersion,
  getAppDescription,
  getCompanyName,
  getContactEmail,
  getSocialLinks,
  getLogoConfig,
  getThemeConfig,
  getFeatureFlags,
  getSEOConfig,
  getAnalyticsConfig,
  isFeatureEnabled,
  getSocialLink,
  getFullUrl,
  isMaintenanceMode,
  
  // Helpers de analytics
  isGoogleAnalyticsEnabled,
  isGoogleTagManagerEnabled,
  isMetaPixelEnabled,
  isLogRocketEnabled,
  getGoogleAnalyticsId,
  getGoogleTagManagerId,
  getMetaPixelId,
  getLogRocketAppId,
  isAnyAnalyticsEnabled
} from './app';

// Export dos hooks de configuração
export {
  useAppConfig,
  useFeature,
  useBranding,
  useContactInfo,
  useDevConfig
} from '../hooks/useAppConfig';

export {
  // Constantes de rotas
  ROUTES,
  
  // Chaves de armazenamento
  STORAGE_KEYS,
  
  // Limites da aplicação
  LIMITS,
  
  // Configurações de API
  API_CONFIG,
  
  // Patterns de validação
  PATTERNS,
  
  // Status HTTP
  HTTP_STATUS,
  
  // Mensagens de erro
  ERROR_MESSAGES,
  
  // Configurações de paginação
  PAGINATION,
  
  // Configurações de tema
  THEME,
  
  // Configurações de i18n
  I18N,
  
  // Estados brasileiros
  BRAZILIAN_STATES,
  
  // DDDs válidos
  VALID_DDDS,
  
  // Configurações de desenvolvimento
  DEV_CONFIG
} from './constants';

// Tipos úteis
export type {
  AppConfig,
  SocialLink,
  ContactInfo,
  CompanyInfo,
  LogoConfig,
  ThemeConfig,
  FeatureFlags,
  SEOConfig,
  AnalyticsConfig
} from './app';