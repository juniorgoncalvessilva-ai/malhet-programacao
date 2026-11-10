# AI Coders - Starter Kit

**AI Coders Starter Kit** é um template moderno e rico em recursos para dashboard admin em Next.js com autenticação Clerk, internacionalização (i18n) e componentes de UI elegantes. Construído para desenvolvedores que desejam prototipagem rápida e construção de aplicações web sofisticadas com as melhores práticas prontas para uso.

## Funcionalidades

- 🔐 **Autenticação**: Integração completa com Clerk incluindo suporte OAuth
- 🌍 **Internacionalização**: Suporte multilíngue (Português e Inglês)
- 🎨 **UI Moderna**: Componentes de dashboard elegantes e responsivos
- 📝 **Validação Avançada**: Sistema completo com Zod + React Hook Form
- 🇧🇷 **Validações Brasileiras**: CPF, CNPJ, CEP, telefone brasileiro
- 📍 **Consulta CEP**: Preenchimento automático via API ViaCEP
- 📱 **WhatsApp Widget**: Widget flutuante para captura de leads com integração webhook
- 📊 **Analytics**: Integração com GA4, GTM, Meta Pixel e LogRocket
- 🔄 **Real-time**: Notificações em tempo real com Supabase
- 🚀 **Next.js 15**: Recursos mais recentes do Next.js com SSR e SSG
- 📱 **Mobile-First**: Design totalmente responsivo
- 🛡️ **TypeScript**: Segurança de tipos de ponta a ponta
- ⚙️ **Configuração Central**: Sistema de configuração unificado para fácil manutenção
- 🎯 **Pronto para Produção**: Otimizado para performance e escalabilidade

**AI Coders Starter Kit** fornece tudo o que você precisa para construir dashboards admin modernos e aplicações web. Seja construindo uma plataforma SaaS, ferramentas internas ou aplicações web complexas, este starter kit acelera seu desenvolvimento com padrões comprovados e integrações.

## Instalação

> **⚠️ IMPORTANTE:** Este projeto agora usa Clerk para autenticação. Você **deve** configurar o Clerk antes de executar a aplicação. Veja a [documentação de autenticação](./docs/02-configuration/autenticacao.md) para instruções detalhadas.

1. Faça o download/fork/clone do repositório e, uma vez no diretório correto, é hora de instalar todas as dependências necessárias. Você pode fazer isso digitando o seguinte comando:

```
npm install
```
Se você estiver usando **Yarn** como gerenciador de pacotes, o comando será:

```
yarn install
```

2. **Configure a autenticação Clerk** - Siga as instruções na [documentação de autenticação](./docs/02-configuration/autenticacao.md) e [integração Clerk-Supabase](./docs/02-configuration/clerk-supabase-integracao.md).

3. Pronto, você está quase lá. Agora tudo que você precisa fazer é iniciar o servidor de desenvolvimento. Se você estiver usando **npm**, o comando é:

```
npm run dev
```
E se você estiver usando **Yarn**, é:

```
yarn dev
```

E voilà! Agora você está pronto para começar a desenvolver. **Bom código**!

## 📝 Sistema de Validação de Formulários

Este starter kit inclui um sistema robusto de validação de formulários construído com **Zod** e **React Hook Form**:

### Funcionalidades de Validação:
- ✅ **Type-Safe**: Validação em tempo de compilação com TypeScript
- ✅ **Tempo Real**: Validação onChange/onBlur com debounce
- ✅ **Validações Brasileiras**: CPF, CNPJ, CEP, telefone brasileiro
- ✅ **Consulta CEP**: Preenchimento automático via API ViaCEP
- ✅ **Feedback Visual**: Estados de erro/sucesso/loading
- ✅ **Acessibilidade**: Suporte completo a ARIA
- ✅ **Dark Mode**: Totalmente compatível com modo escuro

### Como Usar:
```typescript
// Hook de validação
const form = useFormValidation({
  schema: userRegistrationSchema,
  onSubmit: async (data) => { /* ... */ }
});

// Componente validado
<FormInput
  name="email"
  label="Email"
  formContext={form}
  helpText="Digite um email válido"
/>

// Formulário de endereço com CEP automático
<AddressForm
  onSubmit={async (data) => { /* ... */ }}
  autoFillFromCep={true}
/>
```

### Exemplo Completo:
Acesse `/forms/validated-forms` para ver todos os exemplos funcionando, incluindo:
- Formulário de login
- Cadastro de usuário completo
- Formulário de contato
- Perfil de usuário
- **Endereço com consulta automática de CEP**

## 🏪 Gerenciamento de Estado Global com Zustand

Este starter kit utiliza **Zustand** como solução principal para gerenciamento de estado global, oferecendo uma alternativa leve e TypeScript-friendly ao Redux ou Context API:

### Funcionalidades de Estado:
- ✅ **Estado Global Unificado**: Tema, idioma, sidebar, notificações
- ✅ **Sincronização Automática**: Integração com next-themes e next-intl
- ✅ **Performance Otimizada**: Seletores individuais para evitar re-renders
- ✅ **TypeScript Completo**: Tipagem forte em toda a aplicação
- ✅ **DevTools**: Integração com Redux DevTools para debugging
- ✅ **Persistência**: Estado importante salvo automaticamente

### Stores Disponíveis:
```typescript
// Estados principais
import { 
  useTheme, useSetTheme,            // Tema (claro/escuro/sistema)
  useSidebarOpen, useToggleSidebar, // Estado da sidebar
  useShowToast, useNotifications,   // Notificações e toasts
  useLocale, useSetLocale,          // Idioma/localização
  useUser, useIsSignedIn            // Usuário e autenticação
} from '@/store';
```

### Exemplo de Uso:
```typescript
function ThemeToggle() {
  const currentTheme = useTheme();
  const setTheme = useSetTheme();
  const showToast = useShowToast();

  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    showToast({
      type: 'success',
      message: `Tema alterado para ${newTheme}`
    });
  };

  return <button onClick={toggleTheme}>🌙</button>;
}
```

### Demonstração Completa:
Acesse `/state-management` para ver todos os recursos funcionando, incluindo:
- Troca de tema em tempo real
- Mudança de idioma com navegação automática
- Controle de sidebar responsivo  
- Sistema de notificações e toasts
- Estado de usuário sincronizado com Clerk

📖 **Documentação completa**: `/docs/04-architecture/state-management.md`

## 📱 Widget WhatsApp para Captura de Leads

Este starter kit inclui um **widget WhatsApp flutuante** completamente funcional para captura de leads, com integração a webhooks externos:

### ✅ **Funcionalidades do Widget:**
- **Interface Conversacional**: Simula uma conversa do WhatsApp para captura de nome e telefone
- **Design Responsivo**: Funciona perfeitamente em desktop e mobile
- **Integração com Webhooks**: Envia dados capturados para sistemas externos (CRMs, n8n, Zapier, Make.com)
- **Configuração Flexível**: Múltiplos formatos de payload e transformações
- **Analytics**: Integração opcional com LogRocket para tracking
- **Segurança**: Rate limiting e validação de dados

### 🎯 **Como Usar:**
```typescript
// Widget automaticamente ativo quando WHATSAPP_WEBHOOK_URL estiver configurado
// Captura: nome, telefone, timestamp, URL da página
// Envia via POST para webhook configurado

// Configuração no .env.local
WHATSAPP_WEBHOOK_URL=https://seu-webhook-url.com/webhook
WHATSAPP_PHONE_NUMBER=5511999999999  // Seu número do WhatsApp
```

### 🔗 **Casos de Uso:**
- Captura de leads em landing pages
- Suporte ao cliente via WhatsApp
- Integração com sistemas de CRM
- Automação de marketing com n8n/Zapier

**Demonstração**: O widget aparece automaticamente quando configurado  
📖 **Documentação completa**: `/docs/05-features/whatsapp-widget.md`

## 🔄 Gerenciamento de Estado do Servidor com TanStack Query

Este starter kit inclui **TanStack Query (React Query)** **totalmente implementado** para gerenciamento eficiente de estado do servidor, oferecendo cache inteligente, sincronização de dados e otimizações automáticas:

### ✅ **Implementação Completa e Funcional:**
- **QueryClient** configurado com otimizações inteligentes
- **Provider** integrado com DevTools para desenvolvimento
- **Hooks de Query** para buscar dados (perfil, posts, etc.)
- **Hooks de Mutation** para operações CRUD com optimistic updates
- **Integração total** com Supabase RLS + Clerk JWT + Zustand

### 🚀 **Funcionalidades Avançadas:**
```typescript
// Queries com cache automático e tipos seguros
const { data: profile, isLoading } = useCurrentUserProfile();
const { data: posts = [] } = useMyPosts();

// Mutations com optimistic updates e rollback automático
const createPost = useCreatePost();
const updatePost = useUpdatePost();

// Operações com feedback visual via toast (Zustand)
await createPost.mutateAsync({
  title: "Novo Post",
  content: "Conteúdo...",
  published: true
});
// ✅ Cache atualizado automaticamente + toast de sucesso
```

### 🎯 **Demonstração Prática:**
**Acesse `/tanstack-query`** para ver uma demonstração completa funcionando:
- CRUD de posts com optimistic updates
- Gestão de perfil de usuário
- Estados de loading e error
- Cache automático e invalidação
- DevTools para debug (modo desenvolvimento)

### 📚 **Padrões de Uso:**
- **Zustand**: Estado do cliente (UI, tema, preferências)
- **TanStack Query**: Estado do servidor (API, cache, sincronização)
- **Integração**: Toast notifications via Zustand + cache invalidation automático

📖 **Documentação completa**: `/docs/05-features/tanstack-query.md`

## ⚙️ Sistema de Configuração Central

O starter kit possui um sistema de configuração centralizado que facilita a manutenção e personalização da aplicação:

### Configurações Disponíveis:
- 🏢 **Informações da Aplicação**: Nome, versão, descrição, URLs
- 🏛️ **Dados da Empresa**: Nome, endereço, informações legais
- 📞 **Contato**: Email, telefone, website
- 🌐 **Redes Sociais**: Links, usernames, cores personalizadas
- 🎨 **Tema**: Cores primárias, secundárias, modo escuro/claro
- 🎛️ **Features**: Flags de funcionalidades, modo manutenção
- 🔍 **SEO**: Meta tags, Open Graph, Twitter Cards

### Como Usar:
```typescript
// Importar configurações
import { getAppName, getCompanyName, getSocialLinks } from '@/config';

// Usar hooks reativos
const { app, company, social } = useAppConfig();

// Verificar features
const isMaintenanceMode = useFeature('maintenanceMode');

// Branding components
const { appName, logo, colors } = useBranding();
```

### Arquivos de Configuração:
- `src/config/app.ts` - Configuração principal da aplicação
- `src/config/constants.ts` - Constantes e padrões
- `src/config/demo-data.ts` - Dados de demonstração
- `src/hooks/useAppConfig.ts` - Hooks para acesso reativo

Toda a aplicação utiliza essas configurações centralizadas, eliminando hardcoding e facilitando atualizações em produção.

## 📊 Sistema de Analytics Integrado

O starter kit inclui **integração completa com múltiplas plataformas de analytics** para monitoramento e análise de dados:

### 🎯 **Plataformas Suportadas:**
- **Google Analytics 4 (GA4)**: Análise de tráfego e comportamento
- **Google Tag Manager (GTM)**: Gerenciamento centralizado de tags
- **Meta Pixel (Facebook)**: Tracking para campanhas de marketing
- **LogRocket**: Gravações de sessão e debugging em produção

### ⚙️ **Configuração Simples:**
```bash
# .env.local
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX  
NEXT_PUBLIC_META_PIXEL_ID=123456789
NEXT_PUBLIC_LOGROCKET_APP_ID=your-app-id/your-app
```

### ✅ **Funcionalidades Incluídas:**
- **Configuração Automática**: Scripts carregados automaticamente quando configurados
- **Eventos Personalizados**: Tracking de ações específicas da aplicação
- **GDPR Compliance**: Controle de consentimento e privacidade
- **Development Mode**: Desabilitado automaticamente em desenvolvimento
- **Performance**: Carregamento assíncrono sem impacto na performance

### 🔍 **Monitoramento em Produção:**
- Sessões de usuário com LogRocket
- Funis de conversão com GA4
- Campanhas de marketing com Meta Pixel
- Tags personalizadas via GTM

📖 **Documentação completa**: `/docs/02-configuration/analytics.md`

## Funcionalidades em Destaque
**Componentes e Templates Modernos de Dashboard Next.js** - inclui uma variedade de **elementos de UI, componentes, páginas e exemplos** pré-construídos com design de alta qualidade.
Além disso, apresenta **autenticação, internacionalização e funcionalidades extensas** de forma integrada.

- Uma biblioteca com mais de **200** componentes e elementos de UI profissionais para dashboard.
- Cinco variações distintas de dashboard, atendendo a diversos casos de uso.
- Um conjunto abrangente de páginas essenciais de dashboard e admin.
- Mais de **45** arquivos **Next.js** prontos para uso.
- Estilização facilitada por arquivos **Tailwind CSS**.
- Um design que ressoa qualidade premium e alta estética.
- Um kit de UI útil com assets.
- Mais de dez aplicações web completas com exemplos.
- Suporte para **modo escuro** e **modo claro**.
- Integrações essenciais incluindo - Autenticação (**Clerk**), Internacionalização (**next-intl**), Validação (**Zod + React Hook Form**), **Configuração Central**, **Widget WhatsApp**, **Analytics** (GA4, GTM, Meta Pixel, LogRocket) e componentes modernos.
- Documentação detalhada e amigável ao usuário.
- Plugins e add-ons customizáveis.
- Compatibilidade com **TypeScript**.
- E muito mais!

Todas essas funcionalidades e mais fazem do **AI Coders Starter Kit** uma solução robusta e completa para todas as suas necessidades de desenvolvimento de dashboard.

