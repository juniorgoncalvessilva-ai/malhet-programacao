# 🚀 Getting Started

Esta seção contém tudo que você precisa para começar rapidamente com o AI Coders Starter Kit.

## 🎯 Início Rápido

### 1. Clone o Repositório
```bash
git clone https://github.com/your-username/ai-coders-starter-kit.git
cd ai-coders-starter-kit
```

### 2. Instale as Dependências
```bash
npm install
# ou
yarn install
# ou
pnpm install
```

### 3. Configure as Variáveis de Ambiente
```bash
cp .env.example .env.local
```

### 4. Configure os Serviços Necessários
- **Clerk**: Crie uma conta em [clerk.com](https://clerk.com)
- **Supabase**: Crie um projeto em [supabase.com](https://supabase.com)
- **Analytics** (opcional): Configure GA, GTM, Meta Pixel

### 5. Execute o Projeto
```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## 📋 Documentos Disponíveis

### [estrutura-geral.md](./estrutura-geral.md)
- Organização de arquivos e pastas
- Convenções de nomenclatura
- Arquitetura do projeto
- Como navegar no código

## 🔧 Requisitos do Sistema

- **Node.js**: 18.x ou superior
- **npm/yarn/pnpm**: Gerenciador de pacotes
- **Git**: Para controle de versão
- **Editor**: VS Code (recomendado)

## 🎯 Fluxo de Desenvolvimento Recomendado

1. **Configure o Ambiente**
   - Instale as dependências
   - Configure as variáveis de ambiente
   - Configure Clerk e Supabase

2. **Explore a Estrutura**
   - Navegue pelos diretórios principais
   - Entenda a organização dos componentes
   - Familiarize-se com os hooks e stores

3. **Teste as Funcionalidades**
   - Acesse `/app` para ver o dashboard
   - Teste a autenticação
   - Explore os componentes de exemplo

4. **Comece a Desenvolver**
   - Crie novos componentes em `/src/components`
   - Adicione novas rotas em `/src/app`
   - Use os hooks e utilitários existentes

## 🗺️ Principais Rotas

### Páginas Públicas
- `/` - Landing page
- `/auth/sign-in` - Login
- `/auth/sign-up` - Cadastro

### Páginas Autenticadas
- `/app` - Dashboard principal
- `/app/profile` - Perfil do usuário
- `/app/settings` - Configurações

### Páginas de Exemplo
- `/app/api-demo` - Demonstração de APIs
- `/app/calendar` - Componente de calendário
- `/app/charts/basic-chart` - Gráficos
- `/app/forms/*` - Exemplos de formulários
- `/app/state-management` - Gerenciamento de estado
- `/app/tables` - Tabelas de dados
- `/app/tanstack-query` - TanStack Query demo
- `/app/ui-elements/*` - Componentes UI

## 🔗 Próximos Passos

Após completar esta seção, recomendamos:

- **[Configuração](../02-configuration/)** - Personalizar o projeto para suas necessidades
- **[Development](../03-development/)** - Aprender sobre o fluxo de desenvolvimento
- **[Features](../05-features/)** - Explorar funcionalidades específicas

## 💡 Dicas Importantes

- **Variáveis de Ambiente**: Sempre configure corretamente antes de iniciar
- **Migrações**: Execute as migrações do Supabase antes de usar o banco
- **Tipos TypeScript**: São gerados automaticamente do Supabase
- **Convenções**: Siga os padrões estabelecidos no projeto
- **Testing**: Teste localmente antes de fazer deploy