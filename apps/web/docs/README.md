# 📚 Documentação - AI Coders Starter Kit

Bem-vindo à documentação completa do AI Coders Starter Kit! Este guia está organizado por categorias para facilitar a navegação e encontrar exatamente o que você precisa.

## 🎯 O que é o AI Coders Starter Kit?

Um template moderno e completo para desenvolvimento de aplicações web, especialmente focado em dashboards administrativos e SaaS. Inclui autenticação robusta, internacionalização, componentes reutilizáveis e integrações com serviços modernos.

## 🚀 Stack Tecnológica

- **Framework**: Next.js 15.3.3 com App Router
- **UI**: React 19 + TypeScript + Tailwind CSS
- **Autenticação**: Clerk
- **Banco de Dados**: Supabase (com realtime)
- **Estado**: Zustand (client) + TanStack Query (server)
- **Formulários**: React Hook Form + Zod
- **i18n**: next-intl (pt-BR, en)
- **Componentes**: Radix UI + Lucide Icons
- **Analytics**: GA, GTM, Meta Pixel, LogRocket

## 📖 Estrutura da Documentação

### 🚀 [01 - Getting Started](./01-getting-started/)
Tudo que você precisa para começar rapidamente com o projeto.

- **[README.md](./01-getting-started/README.md)** - Visão geral do projeto e instruções básicas
- **[estrutura-geral.md](./01-getting-started/estrutura-geral.md)** - Como o projeto está organizado

### ⚙️ [02 - Configuration](./02-configuration/)
Configuração e personalização do sistema.

- **[README.md](./02-configuration/README.md)** - Visão geral das configurações
- **[configuracao-central.md](./02-configuration/configuracao-central.md)** - Sistema de configuração centralizada
- **[configuracoes.md](./02-configuration/configuracoes.md)** - Configurações gerais do projeto
- **[autenticacao.md](./02-configuration/autenticacao.md)** - Configuração da autenticação Clerk
- **[clerk-supabase-integracao.md](./02-configuration/clerk-supabase-integracao.md)** - Integração Clerk + Supabase
- **[webhooks-clerk.md](./02-configuration/webhooks-clerk.md)** - Configuração de webhooks do Clerk
- **[analytics.md](./02-configuration/analytics.md)** - Configuração de analytics (GA, GTM, Meta Pixel, LogRocket)

### 💻 [03 - Development](./03-development/)
Guias de desenvolvimento e arquitetura.

- **[README.md](./03-development/README.md)** - Visão geral do desenvolvimento
- **[guia-desenvolvimento.md](./03-development/guia-desenvolvimento.md)** - Melhores práticas de desenvolvimento
- **[paginas-rotas.md](./03-development/paginas-rotas.md)** - Sistema de roteamento e páginas
- **[diagramas-mermaid.md](./03-development/diagramas-mermaid.md)** - Diagramas da arquitetura
- **[apis-endpoints.md](./03-development/apis-endpoints.md)** - Criação de APIs autenticadas e não autenticadas
- **[api-examples.md](./03-development/api-examples.md)** - Exemplos práticos de APIs
- **[supabase-local.md](./03-development/supabase-local.md)** - Configuração Supabase local
- **[database-migrations.md](./03-development/database-migrations.md)** - Sistema de migrações do banco

### 🏗️ [04 - Architecture](./04-architecture/)
Arquitetura e padrões do sistema.

- **[state-management.md](./04-architecture/state-management.md)** - Gerenciamento de estado com Zustand e TanStack Query

### 🎨 [04 - Components](./04-components/)
Documentação dos componentes de UI e design system.

- **[README.md](./04-components/README.md)** - Visão geral dos componentes
- **[componentes.md](./04-components/componentes.md)** - Biblioteca de componentes
- **[tema-estilos.md](./04-components/tema-estilos.md)** - Sistema de temas e estilos

### ✨ [05 - Features](./05-features/)
Funcionalidades específicas e integrações.

- **[README.md](./05-features/README.md)** - Visão geral das features
- **[autenticacao.md](./05-features/autenticacao.md)** - Sistema de autenticação com Clerk
- **[internacionalizacao.md](./05-features/internacionalizacao.md)** - Suporte a múltiplos idiomas (pt-BR, en)
- **[validacao-formularios.md](./05-features/validacao-formularios.md)** - Validação avançada com React Hook Form + Zod
- **[whatsapp-widget.md](./05-features/whatsapp-widget.md)** - Widget de contato WhatsApp
- **[supabase-integration.md](./05-features/supabase-integration.md)** - Integração completa com Supabase
- **[zustand-state-management.md](./05-features/zustand-state-management.md)** - Gerenciamento de estado com Zustand
- **[tanstack-query.md](./05-features/tanstack-query.md)** - Gerenciamento de servidor state com TanStack Query
- **[real-time-notifications.md](./05-features/real-time-notifications.md)** - Sistema de notificações em tempo real

### 🚀 [06 - Deployment](./06-deployment/)
Deploy e produção.

- **[deploy.md](./06-deployment/deploy.md)** - Guia de deploy e produção

## 🔍 Busca Rápida

### Por Funcionalidade:
- **Autenticação**: [02-configuration/autenticacao.md](./02-configuration/autenticacao.md) + [05-features/autenticacao.md](./05-features/autenticacao.md)
- **Banco de Dados**: [05-features/supabase-integration.md](./05-features/supabase-integration.md) + [03-development/database-migrations.md](./03-development/database-migrations.md)
- **APIs**: [03-development/apis-endpoints.md](./03-development/apis-endpoints.md) + [03-development/api-examples.md](./03-development/api-examples.md)
- **Formulários**: [05-features/validacao-formularios.md](./05-features/validacao-formularios.md)
- **Componentes**: [04-components/componentes.md](./04-components/componentes.md)
- **Temas**: [04-components/tema-estilos.md](./04-components/tema-estilos.md)
- **Internacionalização**: [05-features/internacionalizacao.md](./05-features/internacionalizacao.md)
- **Gerenciamento de Estado**: [04-architecture/state-management.md](./04-architecture/state-management.md) + [05-features/zustand-state-management.md](./05-features/zustand-state-management.md)
- **Server State**: [05-features/tanstack-query.md](./05-features/tanstack-query.md)
- **Notificações em Tempo Real**: [05-features/real-time-notifications.md](./05-features/real-time-notifications.md)
- **WhatsApp Widget**: [05-features/whatsapp-widget.md](./05-features/whatsapp-widget.md)
- **Analytics**: [02-configuration/analytics.md](./02-configuration/analytics.md)
- **Deploy**: [06-deployment/deploy.md](./06-deployment/deploy.md)

### Por Tipo de Tarefa:
- **Configuração Inicial**: Comece com [01-getting-started/](./01-getting-started/)
- **Desenvolvimento**: Veja [03-development/](./03-development/)
- **Personalização**: Explore [02-configuration/](./02-configuration/)
- **Deploy**: Siga [06-deployment/](./06-deployment/)

## 📝 Como Contribuir

1. Mantenha a organização por categorias
2. Use nomes descritivos para os arquivos
3. Inclua exemplos práticos
4. Atualize este índice quando adicionar novos documentos

## 🆘 Precisa de Ajuda?

- Verifique se sua dúvida está coberta em alguma das categorias acima
- Consulte os exemplos práticos em cada documento
- Para dúvidas específicas, consulte o código fonte correspondente

---

**Última atualização**: Janeiro 2025  
**Versão**: 1.2.1  
**Novidades**: Sistema de notificações em tempo real com TanStack Query, integração com analytics e documentação atualizada