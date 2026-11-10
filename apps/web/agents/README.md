# 🤖 AI Agent Instructions

Este diretório contém instruções específicas para tarefas comuns de desenvolvimento. Use estes guias ao solicitar implementações para AI agents, garantindo contexto completo e melhores resultados.

## 🏗️ IMPORTANTE: Nova Arquitetura Landing + App

### ⚠️ Estrutura de Rotas Atualizada
- **Landing Page**: `/` (público, marketing)
- **Aplicação**: `/app/*` (protegido, funcionalidades)
- **Autenticação**: `/auth/*` (público)

### 📁 Onde Criar Arquivos
- **Páginas da App**: `/src/app/[locale]/app/sua-pagina/`
- **Componentes Landing**: `/src/app/[locale]/_components/`
- **Layout App**: Automático via `/src/app/[locale]/app/layout.tsx`

## ⚠️ Arquitetura de Estado Importante

Este projeto usa **DOIS** sistemas de gerenciamento de estado:
- **Zustand**: Para estado do CLIENTE (UI, tema, notificações, preferências)
- **TanStack Query**: Para estado do SERVIDOR (API data, cache) - ✅ JÁ IMPLEMENTADO

> **NUNCA** armazene dados do servidor no Zustand. Use TanStack Query para isso!

## 📋 Como Usar

1. **Identifique o tipo de tarefa** que precisa implementar
2. **Copie o conteúdo do arquivo correspondente** (.agents/xxx.md)
3. **Cole como contexto** no início da sua solicitação ao AI agent
4. **Adicione os requisitos específicos** da sua feature

## 🗂️ Guias Disponíveis

### Backend Development
- [`backend-api-endpoint.md`](./backend-api-endpoint.md) - Criar endpoints de API
- [`backend-database-integration.md`](./backend-database-integration.md) - Integração com Supabase
- [`backend-middleware.md`](./backend-middleware.md) - Criar middleware customizado

### Frontend Development
- [`frontend-component.md`](./frontend-component.md) - Criar componente React
- [`frontend-page.md`](./frontend-page.md) - Criar nova página
- [`frontend-form.md`](./frontend-form.md) - Criar formulário com validação
- [`frontend-hook.md`](./frontend-hook.md) - Criar custom hook
- [`frontend-state-management.md`](./frontend-state-management.md) - Gerenciar estado do cliente com Zustand
- [`global-state-management.md`](./global-state-management.md) - Guia completo de estado global
- [`tanstack-query-integration.md`](./tanstack-query-integration.md) - **✅ IMPLEMENTADO** - Usar TanStack Query para server state

### Full Stack Features
- [`feature-crud.md`](./feature-crud.md) - Implementar CRUD completo
- [`feature-authentication.md`](./feature-authentication.md) - Adicionar autenticação
- [`feature-realtime.md`](./feature-realtime.md) - Funcionalidade em tempo real

### Integration & Configuration
- [`integration-external-api.md`](./integration-external-api.md) - Integrar API externa
- [`configuration-environment.md`](./configuration-environment.md) - Configurar variáveis

### Code Quality & Review
- [`code-review.md`](./code-review.md) - Revisão de código e conformidade com documentação

## 💡 Exemplo de Uso

```markdown
# Solicitação ao AI Agent

[Cole aqui o conteúdo de .agents/frontend-component.md]

## Requisitos Específicos
- Nome do componente: UserProfile
- Props: userId, showEmail, onEdit
- Deve buscar dados do usuário via API
- Incluir skeleton loading
- Responsivo mobile-first
```

## 🎯 Benefícios

- **Consistência**: Todos os componentes seguem o mesmo padrão
- **Contexto Completo**: AI entende estrutura e convenções
- **Menos Erros**: Referências corretas a arquivos e imports
- **Produtividade**: Implementações mais rápidas e precisas

## 🔧 Customização

Sinta-se livre para:
- Adicionar novos templates para casos específicos
- Modificar templates existentes com padrões do projeto
- Criar variações para diferentes complexidades

## 📚 Referências

Todos os guias se baseiam na documentação oficial em `/docs`:
- Estrutura: `/docs/01-getting-started/estrutura-geral.md`
- APIs: `/docs/03-development/apis-endpoints.md`
- Componentes: `/docs/04-components/componentes.md`
- Estado Global: `/docs/04-architecture/state-management.md`
- Features: `/docs/05-features/`


## 🚨 Common Pitfalls to Avoid

### 1. Component Issues
- ❌ **Don't**: Use kebab-case for component names
- ❌ **Don't**: Create components without proper TypeScript interfaces
- ❌ **Don't**: Hardcode colors or spacing values
- ❌ **Don't**: Forget to export components properly

### 2. Styling Issues
- ❌ **Don't**: Use inline styles or CSS modules
- ❌ **Don't**: Create components without dark mode support
- ❌ **Don't**: Use absolute positioning without responsive considerations
- ❌ **Don't**: Ignore accessibility requirements

### 3. Architecture Issues
- ❌ **Don't**: Create circular dependencies
- ❌ **Don't**: Put business logic in components
- ❌ **Don't**: Skip error handling
- ❌ **Don't**: Use client components when server components would work

## 📋 Pre-submission Checklist

Before completing any task, verify:

### ✅ Code Quality
- [ ] TypeScript compilation passes without errors
- [ ] All components have proper prop interfaces
- [ ] Code follows established naming conventions
- [ ] No console.log or debug code remains

### ✅ Functionality
- [ ] Components work in both light and dark themes
- [ ] Responsive design works on all screen sizes
- [ ] All user-facing text is translated
- [ ] Authentication/authorization is properly implemented

### ✅ Integration
- [ ] New components are properly exported
- [ ] Import paths use absolute imports (`@/`)
- [ ] No breaking changes to existing APIs
- [ ] Documentation is updated if needed

### ✅ Performance
- [ ] No unnecessary re-renders
- [ ] Proper use of Server vs Client components
- [ ] Images are optimized
- [ ] Bundle size impact is considered