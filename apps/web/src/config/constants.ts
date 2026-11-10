/**
 * Constantes da Aplicação
 * 
 * Este arquivo contém todas as constantes utilizadas na aplicação,
 * como rotas, chaves de armazenamento local, limites, etc.
 */

// Rotas da aplicação
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/',
  AUTH: {
    SIGN_IN: '/auth/sign-in',
    SIGN_UP: '/auth/sign-up',
    SSO_CALLBACK: '/auth/sso-callback'
  },
  FORMS: {
    ELEMENTS: '/forms/form-elements',
    LAYOUT: '/forms/form-layout',
    VALIDATED: '/forms/validated-forms'
  },
  UI_ELEMENTS: {
    ALERTS: '/ui-elements/alerts',
    BUTTONS: '/ui-elements/buttons',
    BADGES: '/ui-elements/badges',
    SPINNERS: '/ui-elements/spinners',
    TOASTS: '/ui-elements/toasts',
    DRAWERS: '/ui-elements/drawers',
    CAROUSELS: '/ui-elements/carousels'
  },
  CHARTS: {
    BASIC: '/charts/basic-chart'
  },
  TABLES: '/tables',
  CALENDAR: '/calendar',
  PROFILE: '/profile',
  SETTINGS: '/settings'
} as const;

// Chaves para localStorage
export const STORAGE_KEYS = {
  THEME: 'theme',
  LANGUAGE: 'language',
  SIDEBAR_EXPANDED: 'sidebar-expanded',
  USER_PREFERENCES: 'user-preferences',
  FORM_DRAFT: 'form-draft',
  CEP_CACHE: 'cep-cache'
} as const;

// Limites da aplicação
export const LIMITS = {
  // Formulários
  FORM: {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 100,
    EMAIL_MAX_LENGTH: 255,
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_MAX_LENGTH: 128,
    MESSAGE_MIN_LENGTH: 10,
    MESSAGE_MAX_LENGTH: 1000,
    BIO_MAX_LENGTH: 500,
    PHONE_LENGTH: 15
  },
  
  // Upload de arquivos
  FILE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_FILES: 5,
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
  },
  
  // CEP e endereços
  ADDRESS: {
    CEP_LENGTH: 8,
    STATE_LENGTH: 2,
    STREET_MIN_LENGTH: 5,
    STREET_MAX_LENGTH: 200,
    CITY_MIN_LENGTH: 2,
    CITY_MAX_LENGTH: 100
  },
  
  // UI
  UI: {
    DEBOUNCE_MS: 300,
    ANIMATION_DURATION: 200,
    TOAST_DURATION: 5000,
    TOOLTIP_DELAY: 500
  }
} as const;

// Configurações de API
export const API_CONFIG = {
  // Timeout padrão para requisições
  TIMEOUT: 10000,
  
  // ViaCEP
  VIACEP: {
    BASE_URL: 'https://viacep.com.br/ws',
    TIMEOUT: 5000,
    CACHE_DURATION: 24 * 60 * 60 * 1000 // 24 horas
  },
  
  // Headers padrão
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
} as const;

// Regex patterns para validação
export const PATTERNS = {
  // Validações brasileiras
  CPF: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  CNPJ: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
  CEP: /^\d{5}-\d{3}$/,
  PHONE: /^\(\d{2}\)\s\d{4,5}-\d{4}$/,
  
  // Validações gerais
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
  
  // Validações de texto
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  LETTERS_ONLY: /^[a-zA-ZÀ-ÿ\s]+$/,
  NUMBERS_ONLY: /^\d+$/,
  USERNAME: /^[a-zA-Z0-9_]{3,20}$/
} as const;

// Códigos de status HTTP
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

// Mensagens de erro padrão
export const ERROR_MESSAGES = {
  GENERIC: 'Ocorreu um erro inesperado. Tente novamente.',
  NETWORK: 'Erro de conexão. Verifique sua internet.',
  TIMEOUT: 'A requisição demorou muito para responder.',
  VALIDATION: 'Dados inválidos fornecidos.',
  UNAUTHORIZED: 'Você não tem permissão para esta ação.',
  NOT_FOUND: 'Recurso não encontrado.',
  SERVER_ERROR: 'Erro interno do servidor.',
  
  // Específicos para CEP
  CEP: {
    INVALID_FORMAT: 'CEP deve estar no formato 00000-000',
    NOT_FOUND: 'CEP não encontrado',
    SERVICE_UNAVAILABLE: 'Serviço de CEP indisponível'
  },
  
  // Específicos para formulários
  FORM: {
    REQUIRED_FIELD: 'Este campo é obrigatório',
    INVALID_EMAIL: 'Email inválido',
    WEAK_PASSWORD: 'Senha muito fraca',
    PASSWORDS_DONT_MATCH: 'Senhas não conferem',
    INVALID_PHONE: 'Telefone inválido',
    INVALID_CPF: 'CPF inválido',
    INVALID_CNPJ: 'CNPJ inválido'
  }
} as const;

// Configurações de paginação
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [5, 10, 20, 50, 100],
  MAX_PAGE_SIZE: 100
} as const;

// Configurações de tema
export const THEME = {
  BREAKPOINTS: {
    SM: '640px',
    MD: '768px',
    LG: '1024px',
    XL: '1280px',
    '2XL': '1536px'
  },
  
  COLORS: {
    PRIMARY: '#3b82f6',
    SECONDARY: '#64748b',
    ACCENT: '#8b5cf6',
    DANGER: '#ef4444',
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    INFO: '#06b6d4'
  },
  
  ANIMATIONS: {
    FAST: '150ms',
    NORMAL: '300ms',
    SLOW: '500ms'
  }
} as const;

// Configurações de internacionalização
export const I18N = {
  DEFAULT_LOCALE: 'pt-BR',
  SUPPORTED_LOCALES: ['pt-BR', 'en'] as const,
  FALLBACK_LOCALE: 'pt-BR'
} as const;

// Estados brasileiros
export const BRAZILIAN_STATES = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' }
] as const;

// DDDs válidos por região
export const VALID_DDDS = {
  SOUTHEAST: ['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28'],
  SOUTH: ['41', '42', '43', '44', '45', '46', '47', '48', '49', '51', '53', '54', '55'],
  NORTHEAST: ['71', '73', '74', '75', '77', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89'],
  NORTH: ['61', '62', '63', '64', '65', '66', '67', '68', '69', '91', '92', '93', '94', '95', '96', '97', '98', '99'],
  MIDWEST: ['61', '62', '64', '65', '66', '67']
} as const;

// Configurações para desenvolvimento
export const DEV_CONFIG = {
  LOG_LEVELS: ['debug', 'info', 'warn', 'error'] as const,
  ENABLE_LOGGER: process.env.NODE_ENV === 'development',
  ENABLE_REDUX_DEVTOOLS: process.env.NODE_ENV === 'development',
  SHOW_COMPONENT_OUTLINES: false
} as const;

// Export de tipos úteis
export type RouteKeys = keyof typeof ROUTES;
export type StorageKeys = keyof typeof STORAGE_KEYS;
export type SupportedLocale = typeof I18N.SUPPORTED_LOCALES[number];
export type BrazilianState = typeof BRAZILIAN_STATES[number];