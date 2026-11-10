# Integração com Supabase

O template está preparado para integração completa com Supabase, permitindo adicionar funcionalidades de banco de dados, autenticação adicional, armazenamento e recursos em tempo real.

## 🚀 Configuração Inicial

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto
3. Anote as credenciais:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: Chave pública para o cliente
   - **Service Role Key**: Chave secreta (apenas servidor)

### 2. Variáveis de Ambiente

Adicione ao seu arquivo `.env.local`:

```env
# Supabase Produção
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Local (Desenvolvimento)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54331
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

### 3. Instalar Dependências

```bash
npm install @supabase/supabase-js
```

## 🗄️ Sistema de Migrações

O projeto usa um sistema de migrações organizado e otimizado para Supabase:

### Estrutura de Migrações

```
supabase/migrations/
├── 20240617000001_initial_setup.sql         # Configuração inicial
├── 20240617000002_create_profiles_table.sql # Tabela de perfis
├── 20240617000003_create_posts_table.sql    # Tabela de posts
├── 20240617000004_create_comments_table.sql # Tabela de comentários
├── 20240617000005_realtime_setup.sql        # Configuração Realtime
└── 20240617000006_fix_clerk_rls_policies.sql # Políticas RLS otimizadas
```

### Executar Migrações

**Local (Desenvolvimento):**
```bash
# Iniciar Supabase local
supabase start

# Aplicar todas as migrações
supabase db reset

# Ou aplicar apenas novas migrações
supabase migration up
```

**Produção:**
```bash
# Conectar ao projeto
supabase link --project-ref seu-project-ref

# Aplicar migrações
supabase db push
```

## 📊 Schema do Banco de Dados

### Visão Geral das Tabelas

| Tabela | Função | Relacionamentos |
|--------|--------|----------------|
| `profiles` | Dados de perfil do usuário | Vinculada ao Clerk via `user_id` |
| `posts` | Conteúdo do usuário | `user_id` → Clerk, suporte a publicação |
| `comments` | Comentários em posts | `post_id` → `posts`, `user_id` → Clerk |

### 1. Tabela `profiles`

Otimizada para integração com Clerk:

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL, -- Clerk user ID
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS habilitado automaticamente
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);
```

### 2. Tabela `posts`

Sistema completo de publicação:

```sql
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL, -- Clerk user ID
  title TEXT NOT NULL,
  content TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices otimizados para consultas
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_published ON public.posts(published);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_title ON public.posts(title);
```

### 3. Tabela `comments`

Sistema de comentários com relacionamentos:

```sql
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Clerk user ID
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para relacionamentos
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at DESC);
```

## 🔐 Row Level Security (RLS)

### Função Helper para Clerk

Todas as políticas RLS usam uma função helper otimizada:

```sql
-- Função helper para extrair user_id do JWT do Clerk
CREATE OR REPLACE FUNCTION get_clerk_user_id() 
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claim.sub', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Políticas RLS Simplificadas

**Perfis:**
```sql
-- Usuários podem ver e editar apenas seu próprio perfil
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (user_id = get_clerk_user_id());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = get_clerk_user_id());
```

**Posts:**
```sql
-- Posts públicos visíveis para todos
CREATE POLICY "Anyone can view published posts" ON public.posts
  FOR SELECT USING (published = true);

-- Usuários podem gerenciar seus próprios posts
CREATE POLICY "Users can manage own posts" ON public.posts
  FOR ALL USING (user_id = get_clerk_user_id());
```

**Comentários:**
```sql
-- Comentários em posts públicos são visíveis
CREATE POLICY "View comments on published posts" ON public.comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.posts 
      WHERE posts.id = comments.post_id 
      AND posts.published = true
    )
  );
```

## ⚡ Realtime

### Configuração Automática

As migrações habilitam automaticamente recursos de tempo real:

```sql
-- Adiciona tabelas à publication do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
```

### Uso no Cliente

```typescript
// Subscrever mudanças em posts
const channel = supabase
  .channel('posts-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'posts',
    filter: 'published=eq.true' // Apenas posts publicados
  }, (payload) => {
    console.log('Post atualizado:', payload);
    // Atualizar estado da aplicação
  })
  .subscribe();

// Limpeza
return () => {
  supabase.removeChannel(channel);
};
```

## 🔧 Configuração do Cliente

### Cliente Otimizado para Clerk

```typescript
// src/lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

export const createBrowserClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: async (url, options = {}) => {
          // Injetar token do Clerk automaticamente
          const clerkToken = await window.Clerk?.session?.getToken({
            template: 'supabase'
          });

          const headers = new Headers(options?.headers);
          if (clerkToken) {
            headers.set('Authorization', `Bearer ${clerkToken}`);
          }

          return fetch(url, {
            ...options,
            headers,
          });
        },
      },
    }
  );
};

// Cliente para Server Components
export const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};
```

## 🧪 Exemplos de Uso

### Criar Perfil de Usuário

```typescript
// hooks/useUserProfile.ts
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase/client';

export function useUserProfile() {
  const { user } = useUser();
  const supabase = createBrowserClient();

  const createProfile = async (profileData: {
    full_name?: string;
    avatar_url?: string;
    bio?: string;
  }) => {
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        user_id: user.id,
        full_name: profileData.full_name || user.fullName,
        avatar_url: profileData.avatar_url || user.imageUrl,
        ...profileData
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;
    return data;
  };

  return { createProfile };
}
```

### Sistema de Posts

```typescript
// hooks/usePosts.ts
import { createBrowserClient } from '@/lib/supabase/client';
import { useUser } from '@clerk/nextjs';

export function usePosts() {
  const { user } = useUser();
  const supabase = createBrowserClient();

  const createPost = async (title: string, content: string, published = false) => {
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        title,
        content,
        published
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const getPublishedPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey (
          full_name,
          avatar_url
        )
      `)
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  };

  return { createPost, getPublishedPosts };
}
```

## 🛠️ Desenvolvimento Local

### Setup Completo

```bash
# 1. Instalar Supabase CLI
npm install -g @supabase/cli

# 2. Inicializar projeto (se necessário)
supabase init

# 3. Iniciar stack local
supabase start

# 4. Aplicar migrações
supabase db reset

# 5. Verificar se está funcionando
supabase status
```

### URLs Locais

Após executar `supabase start`:

```
API URL: http://127.0.0.1:54331
Studio URL: http://127.0.0.1:54333  # Interface administrativa
DB URL: postgresql://postgres:postgres@127.0.0.1:54332/postgres
```

### Comandos Úteis

```bash
# Ver status dos serviços
supabase status

# Gerar types TypeScript
supabase gen types typescript --local > src/lib/supabase/types.ts

# Criar nova migração
supabase migration new nome_da_migracao

# Ver logs
supabase logs

# Parar serviços
supabase stop
```

## 🚀 Deploy e Produção

### Conectar ao Projeto

```bash
# Conectar ao projeto Supabase
supabase link --project-ref seu-project-ref

# Verificar diferenças
supabase db diff

# Aplicar migrações
supabase db push
```

### Configurações de Produção

**Environment Variables:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

**Configurações Recomendadas:**
- Habilitar SSL obrigatório
- Configurar backups automáticos
- Monitorar limites de uso
- Configurar alertas de performance

## 📚 Recursos Adicionais

### Documentação
- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime](https://supabase.com/docs/guides/realtime)
- [CLI Reference](https://supabase.com/docs/reference/cli)

### Exemplos no Projeto
- `src/components/SupabaseExample.tsx` - Exemplo de uso
- `src/hooks/queries/` - React Query + Supabase
- `src/hooks/mutations/` - Mutations otimizadas
- `docs/03-development/supabase-local.md` - Setup local detalhado

### Troubleshooting
- Verificar logs: `supabase logs`
- Problemas de conexão: verificar portas e firewall
- RLS não funcionando: verificar políticas e JWT
- Performance: analisar queries e índices