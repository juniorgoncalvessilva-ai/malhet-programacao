# 💻 Development

Esta seção contém guias de desenvolvimento, arquitetura e boas práticas.

## 📋 Documentos Disponíveis

### [guia-desenvolvimento.md](./guia-desenvolvimento.md)
- Melhores práticas de desenvolvimento
- Fluxo de trabalho recomendado
- Convenções de código
- Ferramentas de desenvolvimento

### [paginas-rotas.md](./paginas-rotas.md)
- Sistema de roteamento do Next.js App Router
- Estrutura de páginas e layouts
- Roteamento internacionalizado
- Páginas dinâmicas e estáticas

### [diagramas-mermaid.md](./diagramas-mermaid.md)
- Diagramas da arquitetura do sistema
- Fluxos de dados e navegação
- Estrutura de componentes
- Visualizações técnicas

### [apis-endpoints.md](./apis-endpoints.md)
- Criação de APIs autenticadas e não autenticadas
- Integração com Clerk Authentication
- Middleware e segurança de APIs
- Exemplos práticos e melhores práticas

### [api-examples.md](./api-examples.md)
- Exemplos prontos para uso de endpoints
- Códigos de APIs públicas e protegidas
- Validação, upload de arquivos e webhooks
- Snippets para testes e integração

### [supabase-local.md](./supabase-local.md)
- Simulação completa do Supabase localmente
- Arquitetura dos serviços Docker
- Como funciona Kong Gateway e autenticação
- Debug, troubleshooting e limitações

### [database-migrations.md](./database-migrations.md)
- Sistema de migrações de banco de dados
- Correções aplicadas nas migrações existentes
- Row Level Security (RLS) e integração com Clerk
- Comandos e melhores práticas

## 🛠️ Ferramentas de Desenvolvimento

### Scripts Disponíveis
```bash
# Desenvolvimento
npm run dev          # Desenvolvimento local
npm run build        # Build de produção
npm run start        # Servidor de produção
npm run lint         # Verificação de código

# Database (Supabase)
supabase start       # Iniciar serviços locais
supabase db reset    # Aplicar todas as migrações
supabase migration up # Aplicar apenas novas migrações
supabase status      # Ver status dos serviços
supabase db push     # Deploy migrações para produção
```

### Extensões Recomendadas (VS Code)
- ES7+ React/Redux/React-Native snippets
- Tailwind CSS IntelliSense
- TypeScript Importer
- Auto Rename Tag
- Bracket Pair Colorizer

## 🎯 Fluxo de Desenvolvimento

1. **Planejamento** - Defina a funcionalidade
2. **Estrutura** - Organize arquivos e componentes
3. **Implementação** - Desenvolva seguindo as convenções
4. **Testes** - Teste funcionalidade e responsividade
5. **Review** - Revise código e documentação

## 📁 Estrutura de Desenvolvimento

```
src/
├── app/              # App Router (Next.js 15)
│   ├── [locale]/     # Rotas internacionalizadas
│   │   ├── app/      # Páginas da aplicação autenticada
│   │   ├── auth/     # Páginas de autenticação
│   │   └── layout.tsx
│   ├── api/          # API Routes
│   │   ├── notifications/ # Endpoints de notificações
│   │   ├── protected/     # APIs protegidas
│   │   └── webhooks/      # Webhooks (Clerk, etc)
│   └── providers.tsx      # Providers globais
├── assets/           # Ícones, logos e recursos estáticos
├── components/       # Componentes reutilizáveis
│   ├── FormElements/ # Elementos de formulário
│   ├── Layouts/      # Layouts (header, sidebar, footer)
│   ├── Charts/       # Componentes de gráficos
│   └── ui/           # Componentes UI base
├── hooks/            # Custom hooks
│   ├── api/          # Funções puras de API (Supabase)
│   ├── queries/      # TanStack Query hooks (leitura)
│   ├── mutations/    # TanStack Query hooks (escrita)
│   └── use*.ts       # Hooks diversos
├── store/            # Stores Zustand
│   ├── app-store.ts  # Store principal
│   ├── auth-store.ts # Store de autenticação
│   ├── ui-store.ts   # Store de UI
│   ├── locale-store.ts # Store de internacionalização
│   ├── types.ts      # Tipos compartilhados
│   └── index.ts      # Exports centralizados
├── lib/              # Utilitários e helpers
│   ├── supabase/     # Configuração Supabase
│   └── utils.ts      # Utilitários gerais
├── config/           # Configurações centralizadas
├── providers/        # Providers React
├── schemas/          # Schemas de validação (Zod)
├── services/         # Serviços de negócio
├── types/            # Definições TypeScript
├── i18n/             # Internacionalização
└── middleware.ts     # Middleware do Next.js
```

## 🔗 Integrações

- **Next.js 15** - Framework React com App Router
- **React 19** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização utilitária
- **Radix UI** - Componentes acessíveis
- **next-intl** - Internacionalização (pt-BR, en)
- **Clerk** - Autenticação e gerenciamento de usuários
- **Supabase** - Database PostgreSQL e Real-time
- **Zustand** - Gerenciamento de estado do cliente
- **TanStack Query** - Gerenciamento de estado do servidor
- **React Hook Form** - Formulários performáticos
- **Zod** - Validação de schemas TypeScript
- **Sonner** - Sistema de notificações toast
- **Docker** - Containerização (desenvolvimento local)

## 💡 Boas Práticas

### Gerenciamento de Estado
- **Zustand para cliente**: UI state, preferências, toasts
- **TanStack Query para servidor**: Cache, mutations, real-time sync
- **Seletores individuais**: Evite object selectors no Zustand

### Componentes
- Componentes pequenos e focados em uma responsabilidade
- Use TypeScript para type safety completa
- Siga convenções de nomenclatura estabelecidas
- Implemente loading states e error boundaries

### APIs e Dados
- Separe funções API dos hooks (pasta `/api/`)
- Use mutations do TanStack Query para operações de escrita
- Implemente optimistic updates quando apropriado
- Configure proper error handling

### Desenvolvimento
- Teste em diferentes dispositivos e temas
- Use as extensões VS Code recomendadas
- Documente código complexo e decisões arquiteturais
- Execute migrações do Supabase antes de desenvolver

## 🔗 Próximos Passos

Para aprofundar o desenvolvimento:
- **[Components](../04-components/)** - Trabalhe com componentes
- **[Features](../05-features/)** - Implemente funcionalidades
- **[Deployment](../06-deployment/)** - Deploy para produção