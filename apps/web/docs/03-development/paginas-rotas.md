# Páginas e Rotas

## 📋 Visão Geral

A aplicação utiliza o **App Router** do Next.js 15 com suporte completo à internacionalização através de rotas dinâmicas com locale. A estrutura foi redesenhada para separar claramente a **landing page** (marketing) da **aplicação** (dashboard), proporcionando uma experiência otimizada para cada contexto.

## 🗺️ Estrutura de Roteamento

### Nova Arquitetura de Pastas
```
app/
├── [locale]/              # Locale dinâmico (pt-BR, en)
│   ├── page.tsx          # 🏠 LANDING PAGE (Entrada principal)
│   ├── _components/      # Componentes da landing page
│   ├── auth/             # 🔐 Autenticação (público)
│   ├── app/              # 📱 APLICAÇÃO (protegida)
│   │   ├── layout.tsx    # Layout da aplicação (AuthGuard + Sidebar)
│   │   ├── dashboard/    # Dashboard principal
│   │   ├── calendar/     # Calendário
│   │   ├── charts/       # Gráficos
│   │   ├── forms/        # Formulários
│   │   ├── pages/        # Páginas diversas
│   │   ├── profile/      # Perfil do usuário
│   │   ├── tables/       # Tabelas
│   │   ├── ui-elements/  # Elementos de UI
│   │   ├── api-demo/     # Demonstração de API
│   │   ├── state-management/ # Gerenciamento de estado
│   │   └── tanstack-query/   # TanStack Query
│   └── layout.tsx        # Layout localizado
├── layout.tsx            # Layout raiz
└── providers.tsx         # Providers globais
```

## 🏠 Landing Page (Entrada Principal)

### Página Inicial
```
Rota: /
Arquivo: app/[locale]/page.tsx
```

**Funcionalidades:**
- Hero section com call-to-actions
- Seção de features e benefícios
- Tech stack e demonstrações
- Documentação e guias
- Seção de preços
- Testimonials e estatísticas
- Formulário de contato
- WhatsApp widget

**Componentes específicos:**
- `_components/hero-section.tsx` - Seção principal
- `_components/features-section.tsx` - Features
- `_components/navbar.tsx` - Navegação da landing
- `_components/footer.tsx` - Rodapé da landing

**Comportamento:**
- **Usuários não autenticados**: Visualizam a landing page completa
- **Usuários autenticados**: Redirecionados automaticamente para `/app/dashboard`

## 📱 Aplicação (Área Protegida)

Todas as rotas da aplicação agora vivem sob o prefixo `/app/` e são protegidas por autenticação.

### Dashboard Principal
```
Rota: /app/dashboard
Arquivo: app/[locale]/app/dashboard/page.tsx
```

**Funcionalidades:**
- Cards de visão geral (Overview Cards)
- Chat cards
- Mapa com labels de região
- Métricas principais do dashboard

**Componentes específicos:**
- `app/(home)/_components/overview-cards/` - Cards com estatísticas
- `app/(home)/_components/chats-card.tsx` - Widget de chats
- `app/(home)/_components/region-labels/` - Mapa com regiões

### Calendário
```
Rota: /app/calendar
Arquivo: app/[locale]/app/calendar/page.tsx
```

**Funcionalidades:**
- Visualização de calendário
- Eventos e agendamentos
- Navegação por meses/anos

### Gráficos
```
Rota: /app/charts/*
Diretório: app/[locale]/app/charts/
```

#### Basic Chart
```
Rota: /app/charts/basic-chart
Arquivo: app/[locale]/app/charts/basic-chart/page.tsx
```
- Gráficos básicos com ApexCharts
- Múltiplos tipos de visualização

### Formulários
```
Rota: /app/forms/*
Diretório: app/[locale]/app/forms/
```

#### Form Elements
```
Rota: /app/forms/form-elements
Arquivo: app/[locale]/app/forms/form-elements/page.tsx
```
- Showcase de elementos de formulário
- Inputs, selects, checkboxes, etc.

#### Form Layout
```
Rota: /app/forms/form-layout
Arquivo: app/[locale]/app/forms/form-layout/page.tsx
```
- Layouts de formulários
- Formulários de contato, login, cadastro

**Componentes específicos:**
- `app/forms/form-layout/_components/contact-form.tsx` - Formulário de contato
- `app/forms/form-layout/_components/sign-in-form.tsx` - Formulário de login
- `app/forms/form-layout/_components/sign-up-form.tsx` - Formulário de cadastro

### Tabelas
```
Rota: /app/tables
Arquivo: app/[locale]/app/tables/page.tsx
```

**Funcionalidades:**
- Tabelas responsivas
- Paginação e ordenação
- Filtros e busca

### Perfil do Usuário
```
Rota: /app/profile
Diretório: app/[locale]/app/profile/
Layout: app/[locale]/app/profile/layout.tsx
```

**Funcionalidades:**
- Informações do perfil
- Configurações pessoais
- Contas sociais

**Componentes específicos:**
- `app/profile/_components/social-accounts.tsx` - Contas sociais
- `app/profile/_components/icons.tsx` - Ícones do perfil

### Configurações
```
Rota: /app/settings
Arquivo: app/[locale]/app/settings/page.tsx
```

**Funcionalidades:**
- Configurações pessoais
- Upload de foto
- Preferências do usuário

**Componentes específicos:**
- `app/settings/_components/personal-info.tsx` - Informações pessoais
- `app/settings/_components/upload-photo.tsx` - Upload de avatar

### Demonstração de API
```
Rota: /app/api-demo
Arquivo: app/[locale]/app/api-demo/page.tsx
```

**Funcionalidades:**
- Demonstração de APIs protegidas
- Exemplos de autenticação
- Testing de endpoints

### Gerenciamento de Estado
```
Rota: /app/state-management
Arquivo: app/[locale]/app/state-management/page.tsx
```

**Funcionalidades:**
- Demonstração de Zustand
- Exemplos de estado global
- Sincronização de dados

### TanStack Query
```
Rota: /app/tanstack-query
Arquivo: app/[locale]/app/tanstack-query/page.tsx
```

**Funcionalidades:**
- Demonstração de React Query
- Cache e sincronização
- Mutações e queries

### Elementos de UI
```
Rota: /app/ui-elements/*
Diretório: app/[locale]/app/ui-elements/
```

#### Alerts
```
Rota: /app/ui-elements/alerts
Arquivo: app/[locale]/app/ui-elements/alerts/page.tsx
```
- Showcase de alertas
- Diferentes tipos e estados

#### Buttons
```
Rota: /app/ui-elements/buttons
Arquivo: app/[locale]/app/ui-elements/buttons/page.tsx
```
- Showcase de botões
- Variantes e tamanhos

## 🔐 Páginas de Autenticação

### Sign In
```
Rota: /auth/sign-in
Arquivo: app/[locale]/auth/sign-in/page.tsx
```

**Funcionalidades:**
- Login com email/senha
- OAuth (Google, GitHub, etc.)
- Redirecionamento automático

#### SSO Callback
```
Rota: /auth/sign-in/sso-callback
Arquivo: app/[locale]/auth/sign-in/sso-callback/page.tsx
```
- Callback para OAuth
- Tratamento de erros de autenticação

### Sign Up
```
Rota: /auth/sign-up
Arquivo: app/[locale]/auth/sign-up/page.tsx
```

**Funcionalidades:**
- Cadastro de novos usuários
- Validação de dados
- Integração com Clerk

#### SSO Callback
```
Rota: /auth/sign-up/sso-callback
Arquivo: app/[locale]/auth/sign-up/sso-callback/page.tsx
```
- Callback para cadastro via OAuth

## 🌍 Internacionalização de Rotas

### Locales Suportados
- **pt-BR**: Português brasileiro (padrão)
- **en**: Inglês

### Estrutura de URLs

#### Landing Page (Público)
```
# Português (padrão)
/pt-BR                    # Landing page
/pt-BR/auth/sign-in      # Login
/pt-BR/auth/sign-up      # Cadastro

# Inglês
/en                      # Landing page
/en/auth/sign-in         # Login
/en/auth/sign-up         # Cadastro
```

#### Aplicação (Protegida)
```
# Português (padrão)
/pt-BR/app/dashboard     # Dashboard
/pt-BR/app/calendar      # Calendário
/pt-BR/app/charts        # Gráficos
/pt-BR/app/forms         # Formulários

# Inglês
/en/app/dashboard        # Dashboard
/en/app/calendar         # Calendar
/en/app/charts           # Charts
/en/app/forms            # Forms
```

### Configuração
```typescript
// i18n/routing.ts
export const routing = defineRouting({
  locales: ['pt-BR', 'en'],
  defaultLocale: 'pt-BR'
});
```

## 🛡️ Proteção de Rotas

### Middleware
```typescript
// middleware.ts
```
- Redirecionamento automático para login
- Detecção de locale
- Proteção de rotas privadas

### Auth Guard
Páginas protegidas utilizam o componente `AuthGuard`:
```typescript
// components/auth-guard.tsx
```

### Rotas Públicas
- `/` - Landing page
- `/auth/sign-in` - Página de login
- `/auth/sign-up` - Página de cadastro
- `/auth/*/sso-callback` - Callbacks OAuth

### Rotas Privadas (Protegidas por AuthGuard)
- `/app/dashboard` - Dashboard principal
- `/app/*` - Todas as páginas da aplicação
- Layout automático com sidebar e header

## 📱 Layouts

### Root Layout
```typescript
// app/layout.tsx
```
- Configuração global
- Providers (Clerk, Theme)
- Meta tags e SEO

### Localized Layout
```typescript
// app/[locale]/layout.tsx
```
- Configuração de internacionalização
- ConditionalLayout para roteamento
- Estrutura base da aplicação

### App Layout (Novo)
```typescript
// app/[locale]/app/layout.tsx
```
- AuthGuard para proteção de rotas
- Sidebar de navegação
- Header da aplicação
- Layout específico para área da aplicação

### Profile Layout
```typescript
// app/[locale]/app/profile/layout.tsx
```
- Layout específico para páginas de perfil
- Navegação do perfil

## 🔍 SEO e Metadata

### Metadata Global
```typescript
// app/layout.tsx
export const metadata: Metadata = {
  title: {
    template: '%s | AI Coders - Starter Kit',
    default: 'AI Coders - Starter Kit'
  },
  description: 'A modern Next.js admin dashboard...'
};
```

### Metadata por Página
Cada página pode definir seu próprio metadata:
```typescript
export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Overview of your application metrics'
};
```

## 🚀 Performance

### Static Generation
- Páginas estáticas quando possível
- ISR (Incremental Static Regeneration) para dados dinâmicos

### Dynamic Imports
- Componentes carregados sob demanda
- Code splitting automático

### Loading States
- `loading.tsx` para estados de carregamento
- Skeleton components para UX

## 📊 Fetching de Dados

### Server Components
```typescript
// app/[locale]/(home)/fetch.ts
```
- Fetch no servidor
- Dados hidratados no cliente

### Client Components
- `use client` para interatividade
- Hooks para estado local

## 🏗️ Nova Arquitetura: Landing + App

### Separação Clara de Contextos

A nova estrutura separa claramente dois contextos distintos:

#### 🏠 Landing Page (Marketing)
- **Propósito**: Apresentar o produto, converter visitantes
- **Público**: Usuários não autenticados
- **Layout**: Navbar + Content + Footer
- **Funcionalidades**: Hero, Features, Pricing, Testimonials

#### 📱 Aplicação (Dashboard)
- **Propósito**: Funcionalidades do produto
- **Público**: Usuários autenticados
- **Layout**: Sidebar + Header + Content
- **Funcionalidades**: Dashboard, CRUD, relatórios

### Vantagens da Nova Estrutura

1. **Performance**: Landing page otimizada para SEO e conversão
2. **Manutenção**: Separação clara de responsabilidades
3. **Escalabilidade**: Cada contexto pode evoluir independentemente
4. **UX**: Experiência otimizada para cada tipo de usuário

### Fluxo de Navegação
```mermaid
flowchart TD
    A[Usuário acessa /] --> B{Autenticado?}
    B -->|Não| C[Landing Page]
    B -->|Sim| D[Redirect /app/dashboard]
    C --> E[Call-to-Action]
    E --> F[/auth/sign-up]
    F --> G[Cadastro/Login]
    G --> H[Redirect /app/dashboard]
    D --> I[Aplicação com Sidebar]
```

## 🔧 Customização de Rotas

### Grupos de Rotas
- `(home)` - Agrupa páginas relacionadas sem afetar URL
- `app/` - Grupo protegido para aplicação
- Organização lógica sem impacto na estrutura

### Rotas Dinâmicas
- `[locale]` - Parâmetro dinâmico para internacionalização
- `[id]` - Para páginas com IDs dinâmicos

### Layouts Condicionais
- ConditionalLayout determina qual layout usar
- Landing pages: sem wrapper
- Auth pages: layout simples
- App pages: layout completo com sidebar

### Intercepting Routes
- Modais que interceptam navegação
- UX melhorada para ações rápidas