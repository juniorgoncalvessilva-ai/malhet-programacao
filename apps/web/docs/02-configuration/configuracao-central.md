# Sistema de Configuração Central

Este documento explica como usar e customizar o sistema de configuração centralizado do AI Coders Starter Kit.

## Visão Geral

O sistema de configuração central foi projetado para eliminar hardcoding de informações da aplicação, facilitando manutenção, personalização e deployment em diferentes ambientes.

## Estrutura de Arquivos

```
src/config/
├── app.ts           # Configuração principal da aplicação
├── constants.ts     # Constantes e padrões
├── demo-data.ts     # Dados de demonstração
└── index.ts         # Re-exports organizados
```

## Configuração Principal (`app.ts`)

### Informações da Aplicação

```typescript
const appConfig = {
  app: {
    name: "AI Coders - Starter Kit",
    version: "1.2.1",
    description: "Template moderno e rico em recursos para dashboard admin",
    url: "https://your-domain.com",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo"
  }
}
```

### Informações da Empresa

```typescript
company: {
  name: "AI Coders",
  legalName: "AI Coders Tecnologia Ltda",
  description: "Soluções inovadoras em inteligência artificial",
  tagline: "Transformando ideias em código inteligente",
  founded: "2024",
  address: {
    street: "Avenida Paulista, 1578",
    city: "São Paulo",
    state: "SP",
    zipCode: "01310-200",
    country: "Brasil"
  }
}
```

### Informações de Contato

```typescript
contact: {
  email: "contato@aicoders.dev",
  phone: "+55 (11) 99999-0000",
  website: "https://aicoders.dev"
}
```

### Redes Sociais

```typescript
social: [
  {
    name: "GitHub",
    url: "https://github.com/aicoders",
    username: "@aicoders",
    icon: FaGithub,
    color: "#333"
  },
  {
    name: "LinkedIn",
    url: "https://linkedin.com/company/aicoders",
    username: "@aicoders",
    icon: FaLinkedin,
    color: "#0077B5"
  }
]
```

### Configuração de Tema

```typescript
theme: {
  primaryColor: "#3b82f6",
  secondaryColor: "#8F95B2",
  accentColor: "#06B6D4",
  dangerColor: "#F87171",
  successColor: "#34D399",
  warningColor: "#FBBF24",
  infoColor: "#60A5FA"
}
```

### Feature Flags

```typescript
features: {
  analytics: true,
  darkMode: true,
  notifications: true,
  maintenance: false,
  betaFeatures: false
}
```

## Hooks para Acesso Reativo

### `useAppConfig()`

Hook principal que retorna toda a configuração de forma reativa:

```typescript
import { useAppConfig } from '@/config';

function MyComponent() {
  const {
    app,
    company,
    contact,
    social,
    theme,
    features,
    // Helpers
    isFeatureEnabled,
    getSocialLink,
    getFullUrl
  } = useAppConfig();

  return (
    <div>
      <h1>{app.name}</h1>
      <p>{company.description}</p>
      {isFeatureEnabled('notifications') && <NotificationBell />}
    </div>
  );
}
```

### `useFeature(featureName)`

Hook específico para verificar features:

```typescript
import { useFeature } from '@/config';

function AnalyticsComponent() {
  const analyticsEnabled = useFeature('analytics');
  
  if (!analyticsEnabled) return null;
  
  return <AnalyticsWidget />;
}
```

### `useBranding()`

Hook para informações de marca e tema:

```typescript
import { useBranding } from '@/config';

function Header() {
  const { appName, companyName, logo, colors } = useBranding();
  
  return (
    <header style={{ backgroundColor: colors.primary }}>
      <img src={logo.main} alt={appName} />
      <h1>{appName}</h1>
    </header>
  );
}
```

### `useContactInfo()`

Hook para informações de contato:

```typescript
import { useContactInfo } from '@/config';

function Footer() {
  const { email, phone, social, address } = useContactInfo();
  
  return (
    <footer>
      <p>Email: {email}</p>
      <p>Telefone: {phone}</p>
      <div>
        {social.map(link => (
          <a key={link.name} href={link.url}>{link.name}</a>
        ))}
      </div>
    </footer>
  );
}
```

## Funções Helper

### Getters Básicos

```typescript
import { 
  getAppName, 
  getAppVersion,
  getCompanyName,
  getContactEmail,
  getSocialLinks 
} from '@/config';

// Uso simples em componentes funcionais
const appName = getAppName(); // "AI Coders - Starter Kit"
const version = getAppVersion(); // "1.2.1"
const email = getContactEmail(); // "contato@aicoders.dev"
```

### Verificação de Features

```typescript
import { isFeatureEnabled } from '@/config';

// Verificar se uma feature está habilitada
if (isFeatureEnabled('analytics')) {
  // Inicializar analytics
}

if (isFeatureEnabled('betaFeatures')) {
  // Mostrar features beta
}
```

### Utilitários de URL

```typescript
import { getFullUrl } from '@/config';

const baseUrl = getFullUrl(); // "https://your-domain.com"
const pageUrl = getFullUrl('/about'); // "https://your-domain.com/about"
```

## Dados de Demonstração (`demo-data.ts`)

### Usuários Demo

```typescript
import { getDemoUser, getDemoUsers } from '@/config';

// Obter usuário específico
const user = getDemoUser('1');

// Obter todos os usuários
const users = getDemoUsers();

// Usar em componentes
function UserProfile() {
  const demoUser = getDemoUser();
  
  return (
    <div>
      <h2>{demoUser.name}</h2>
      <p>{demoUser.email}</p>
    </div>
  );
}
```

### Notificações Demo

```typescript
import { getDemoNotifications, getUnreadNotificationsCount } from '@/config';

function NotificationBell() {
  const notifications = getDemoNotifications();
  const unreadCount = getUnreadNotificationsCount();
  
  return (
    <div>
      <span>Notificações ({unreadCount})</span>
      {notifications.map(notif => (
        <div key={notif.id}>{notif.message}</div>
      ))}
    </div>
  );
}
```

### Dados de Formulário Demo

```typescript
import { demoFormData } from '@/config';

function PersonalInfoForm() {
  return (
    <form>
      <input 
        defaultValue={demoFormData.personalInfo.name}
        placeholder={demoFormData.personalInfo.name}
      />
      <input 
        defaultValue={demoFormData.personalInfo.email}
        placeholder={demoFormData.personalInfo.email}
      />
    </form>
  );
}
```

## Constantes (`constants.ts`)

### Padrões de Validação Brasileiros

```typescript
import { PATTERNS } from '@/config';

// Regex para validações
const cpfPattern = PATTERNS.CPF; // /^\d{3}\.\d{3}\.\d{3}-\d{2}$/
const cnpjPattern = PATTERNS.CNPJ;
const cepPattern = PATTERNS.CEP;
const phonePattern = PATTERNS.PHONE;
```

### Limites da Aplicação

```typescript
import { LIMITS } from '@/config';

const maxFileSize = LIMITS.FILE_UPLOAD.MAX_SIZE; // 5MB
const maxUsers = LIMITS.USERS.MAX_PER_ORGANIZATION; // 100
```

### Rotas da Aplicação

```typescript
import { ROUTES } from '@/config';

// Navegar programaticamente
router.push(ROUTES.DASHBOARD);
router.push(ROUTES.PROFILE.SETTINGS);
```

## Personalização

### 1. Modificar Configurações

Edite `src/config/app.ts` para personalizar:

```typescript
// Alterar nome da aplicação
app: {
  name: "Minha Aplicação Custom",
  // ...
}

// Alterar cores do tema
theme: {
  primaryColor: "#FF6B6B", // Sua cor primária
  // ...
}

// Configurar suas redes sociais
social: [
  {
    name: "Instagram",
    url: "https://instagram.com/meuhandle",
    // ...
  }
]
```

### 2. Adicionar Novas Configurações

```typescript
// Em app.ts, adicionar nova seção
export const appConfig = {
  // ... configurações existentes
  
  // Nova configuração
  payment: {
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_KEY,
    enablePayments: true,
    currency: "BRL"
  }
};

// Criar helper function
export function getPaymentConfig() {
  return appConfig.payment;
}

// Usar em componentes
import { getPaymentConfig } from '@/config';

const paymentConfig = getPaymentConfig();
if (paymentConfig.enablePayments) {
  // Inicializar Stripe
}
```

### 3. Configurações por Ambiente

```typescript
// app.ts
const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

export const appConfig = {
  app: {
    name: isProd ? "Produção App" : "Dev App",
    url: isProd 
      ? "https://meusite.com" 
      : "http://localhost:3000"
  },
  
  features: {
    analytics: isProd, // Só ativar em produção
    debugMode: isDev,  // Só em desenvolvimento
  }
};
```

## Boas Práticas

### 1. Sempre Use as Configurações

❌ **Evite hardcoding:**
```typescript
// Ruim
<h1>AI Coders - Starter Kit</h1>
<a href="mailto:contato@aicoders.dev">Contato</a>
```

✅ **Use configurações centralizadas:**
```typescript
// Bom
import { getAppName, getContactEmail } from '@/config';

<h1>{getAppName()}</h1>
<a href={`mailto:${getContactEmail()}`}>Contato</a>
```

### 2. Use Hooks em Componentes Reativos

```typescript
// Para componentes que precisam reagir a mudanças
function DynamicComponent() {
  const { app, isFeatureEnabled } = useAppConfig();
  
  return (
    <div>
      <h1>{app.name}</h1>
      {isFeatureEnabled('notifications') && <NotificationCenter />}
    </div>
  );
}
```

### 3. Organize Configurações por Domínio

```typescript
// Para aplicações grandes, considere separar por domínios
export const authConfig = {
  // Configurações de autenticação
};

export const paymentConfig = {
  // Configurações de pagamento
};

export const emailConfig = {
  // Configurações de email
};
```

### 4. Validação de Configurações

```typescript
// Adicione validação para configurações críticas
function validateConfig() {
  const config = appConfig;
  
  if (!config.app.name) {
    throw new Error('App name is required');
  }
  
  if (!config.contact.email) {
    throw new Error('Contact email is required');
  }
}

// Chame na inicialização da app
validateConfig();
```

## Integração com Outros Sistemas

### Next.js Metadata

```typescript
// app/layout.tsx
import { getSEOConfig } from '@/config';

export async function generateMetadata() {
  const seo = getSEOConfig();
  
  return {
    title: seo.title,
    description: seo.description,
    openGraph: seo.openGraph,
    twitter: seo.twitter
  };
}
```

### Internacionalização

```typescript
// Integrar com next-intl
import { useAppConfig } from '@/config';

function LocalizedComponent() {
  const { app } = useAppConfig();
  const t = useTranslations();
  
  return (
    <div>
      <h1>{t('welcome', { appName: app.name })}</h1>
    </div>
  );
}
```

### Analytics

```typescript
// Configurar analytics baseado nas configs
import { useFeature, getAppName } from '@/config';

function AnalyticsProvider({ children }) {
  const analyticsEnabled = useFeature('analytics');
  const appName = getAppName();
  
  useEffect(() => {
    if (analyticsEnabled) {
      // Inicializar analytics
      gtag('config', 'GA_MEASUREMENT_ID', {
        custom_map: { 
          app_name: appName 
        }
      });
    }
  }, [analyticsEnabled, appName]);
  
  return children;
}
```

## Troubleshooting

### Problema: Configuração não atualiza

**Solução:** Verifique se está usando os hooks reativos (`useAppConfig`) em vez das funções getter estáticas.

### Problema: TypeScript errors

**Solução:** Certifique-se de que os tipos estão sendo exportados corretamente em `src/config/index.ts`.

### Problema: Build falha

**Solução:** Verifique se todas as configurações obrigatórias estão definidas e se não há referências a variáveis de ambiente undefined.

## Exemplos Completos

Veja os seguintes arquivos para exemplos de uso:

- `src/components/logo.tsx` - Uso básico de configurações
- `src/components/footer.tsx` - Exemplo completo com múltiplas configurações
- `src/app/layout.tsx` - Integração com metadata do Next.js
- `src/components/Layouts/header/index.tsx` - Uso em componentes de layout
- `src/app/[locale]/profile/_components/social-accounts.tsx` - Redes sociais dinâmicas

O sistema de configuração central torna a aplicação mais flexível, manutenível e fácil de personalizar para diferentes necessidades e ambientes.