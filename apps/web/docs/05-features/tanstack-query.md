# Gerenciamento de Estado do Servidor com TanStack Query

O template integra [TanStack Query (React Query)](https://tanstack.com/query/latest) para gerenciamento eficiente de estado do servidor, complementando o Zustand para estado do cliente.

> **✅ Implementação Ativa**: O TanStack Query está **totalmente implementado** e funcional no template. Visite a página `/tanstack-query` para ver a demonstração completa.

## 🚀 Por que TanStack Query?

### Vantagens
- ✅ **Cache Automático**: Gerenciamento inteligente de cache de dados
- ✅ **Background Updates**: Atualizações em segundo plano
- ✅ **Otimização**: Deduplicação de requests e cache inteligente
- ✅ **DevTools**: Ferramentas de debug excepcionais
- ✅ **Offline Support**: Funciona offline com dados em cache
- ✅ **Invalidation**: Sistema robusto de invalidação de cache
- ✅ **Loading States**: Estados de loading automáticos

### vs Fetch Tradicional
```typescript
// ❌ Fetch tradicional - muito boilerplate
const [users, setUsers] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
  setLoading(true);
  fetch('/api/users')
    .then(res => res.json())
    .then(data => {
      setUsers(data);
      setLoading(false);
    })
    .catch(err => {
      setError(err);
      setLoading(false);
    });
}, []);

// ✅ TanStack Query - simples e poderoso
const { data: users, isLoading, error } = useQuery({
  queryKey: ['users'],
  queryFn: () => fetch('/api/users').then(res => res.json())
});
```

## 🎯 Estratégia de Separação de Estado

### ✅ Use Zustand Para (Estado do Cliente)
- Estado da UI (tema, sidebar, modais)
- Preferências do usuário
- Status de autenticação
- Notificações locais
- Estado da aplicação

### ✅ Use TanStack Query Para (Estado do Servidor)
- Dados de APIs
- Perfis de usuários
- Posts, comentários, conteúdo
- Sincronização em tempo real
- Cache de dados do servidor

## 📦 Instalação e Configuração

> **✅ Já Configurado**: As dependências já estão instaladas e configuradas no template.

```bash
# Dependências já incluídas no package.json
@tanstack/react-query
@tanstack/react-query-devtools
```

### Cliente de Query (✅ Implementado)
```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (atualizado para v5)
      retry: (failureCount, error: any) => {
        // Não retentar erros de autenticação
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false, // Melhor UX
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### Provider Setup (✅ Implementado)
```typescript
// src/app/providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ZustandProvider>
            <SidebarProvider>
              {children}
              <ToastProvider />
              {process.env.NODE_ENV === 'development' && (
                <ReactQueryDevtools initialIsOpen={false} />
              )}
            </SidebarProvider>
          </ZustandProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
```

## 🔧 Hooks de Query (✅ Implementados)

> **📁 Localização**: Todos os hooks estão implementados em `/src/hooks/queries/` e `/src/hooks/mutations/`

### 1. Query de Perfil de Usuário
```typescript
// src/hooks/queries/useUser.ts (✅ Implementado)
import { useQuery } from '@tanstack/react-query';
import { useSupabase, useSupabaseUser } from '@/hooks/useSupabase';
import { useUser } from '@clerk/nextjs';
import type { Database } from '@/lib/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

// Query para perfil de qualquer usuário
export function useUserProfile(userId: string) {
  const supabase = useSupabase();
  
  return useQuery({
    queryKey: ['user', 'profile', userId],
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

// Query para perfil do usuário atual (otimizada)
export function useCurrentUserProfile() {
  const { user } = useUser();
  const { profile, loading } = useSupabaseUser();
  
  return useQuery({
    queryKey: ['user', 'profile', 'current', user?.id],
    queryFn: async (): Promise<Profile | null> => {
      return profile;
    },
    enabled: !loading && !!user?.id,
    initialData: profile,
  });
}
```

### 2. Queries de Posts com RLS
```typescript
// src/hooks/queries/usePosts.ts (✅ Implementado)
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@clerk/nextjs';
import type { Database } from '@/lib/supabase/types';

type Post = Database['public']['Tables']['posts']['Row'];

// Todos os posts (respeitando RLS)
export function usePosts() {
  const supabase = useSupabase();
  
  return useQuery({
    queryKey: ['posts'],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });
}

// Posts apenas publicados (área pública)
export function usePublishedPosts() {
  const supabase = useSupabase();
  
  return useQuery({
    queryKey: ['posts', 'published'],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });
}

// Posts do usuário autenticado
export function useMyPosts() {
  const { user } = useUser();
  const supabase = useSupabase();
  
  return useQuery({
    queryKey: ['posts', 'my', user?.id],
    queryFn: async (): Promise<Post[]> => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
```

## 🔄 Mutations (✅ Implementadas)

> **📁 Localização**: Todas as mutations estão em `/src/hooks/mutations/`

### 1. Mutation de Perfil com RLS
```typescript
// src/hooks/mutations/useProfile.ts (✅ Implementado)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useShowToast } from '@/store';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@clerk/nextjs';
import type { Database } from '@/lib/supabase/types';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  const supabase = useSupabase();
  const { user } = useUser(); // Clerk user
  
  return useMutation({
    mutationFn: async (updates: ProfileUpdate): Promise<Profile> => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // RLS automaticamente valida que só pode atualizar próprio perfil
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (updatedProfile) => {
      // Atualiza o cache do perfil
      queryClient.setQueryData(['user', updatedProfile.user_id], updatedProfile);
      
      // Invalida queries relacionadas
      queryClient.invalidateQueries(['user']);
      
      // Toast de sucesso via Zustand
      showToast({
        type: 'success',
        message: 'Perfil atualizado com sucesso!'
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.message || 'Falha ao atualizar perfil'
      });
    },
  });
}
```

### 2. Optimistic Updates com Validação RLS
```typescript
// src/hooks/mutations/useCreatePost.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useShowToast } from '@/store';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@clerk/nextjs';
import type { Database } from '@/lib/supabase/types';

type PostInsert = Database['public']['Tables']['posts']['Insert'];
type Post = Database['public']['Tables']['posts']['Row'];

export function useCreatePost() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  const supabase = useSupabase();
  const { user } = useUser();
  
  return useMutation({
    mutationFn: async (newPost: Omit<PostInsert, 'user_id'>): Promise<Post> => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // RLS automaticamente valida permissão de inserção
      const { data, error } = await supabase
        .from('posts')
        .insert({
          ...newPost,
          user_id: user.id, // Sempre usa o user ID do Clerk
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: async (newPost) => {
      if (!user?.id) return;
      
      // Cancela queries pendentes
      await queryClient.cancelQueries(['posts']);
      await queryClient.cancelQueries(['posts', 'my']);
      
      // Snapshot dos valores anteriores
      const previousPosts = queryClient.getQueryData(['posts']);
      const previousMyPosts = queryClient.getQueryData(['posts', 'my', user.id]);
      
      // Create optimistic post
      const optimisticPost: Post = {
        id: 'temp-' + Date.now(),
        user_id: user.id,
        title: newPost.title || '',
        content: newPost.content || null,
        published: newPost.published || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Update otimista
      queryClient.setQueryData(['posts'], (old: Post[] = []) => [optimisticPost, ...old]);
      queryClient.setQueryData(['posts', 'my', user.id], (old: Post[] = []) => [optimisticPost, ...old]);
      
      return { previousPosts, previousMyPosts };
    },
    onError: (error, newPost, context) => {
      // Rollback em caso de erro
      if (context?.previousPosts) {
        queryClient.setQueryData(['posts'], context.previousPosts);
      }
      if (context?.previousMyPosts && user?.id) {
        queryClient.setQueryData(['posts', 'my', user.id], context.previousMyPosts);
      }
      
      showToast({
        type: 'error',
        message: error.message || 'Falha ao criar post'
      });
    },
    onSuccess: (createdPost) => {
      showToast({
        type: 'success',
        message: 'Post criado com sucesso!'
      });
    },
    onSettled: () => {
      // Sempre refetch para garantir consistência
      queryClient.invalidateQueries(['posts']);
    },
  });
}
```

## 🎯 Demonstração Prática (✅ Implementada)

### Página de Demo Completa

> **🔗 Acesso**: Visite `/tanstack-query` no template para ver a implementação funcionando

O template inclui uma demonstração completa em:
- **Componente**: `/src/components/TanStackQuery/TanStackQueryDemo.tsx`
- **Página**: `/src/app/[locale]/tanstack-query/page.tsx`
- **Navegação**: Link "TanStack Query" no menu lateral

### Funcionalidades Demonstradas

1. **👤 Perfil do Usuário**
   - Query do perfil atual usando `useCurrentUserProfile()`
   - Mutation para atualizar nome usando `useUpdateProfile()`
   - Cache automático e invalidação

2. **📝 CRUD de Posts**
   - Criar posts com `useCreatePost()` e **optimistic updates**
   - Listar posts pessoais com `useMyPosts()`
   - Listar posts públicos com `usePublishedPosts()`
   - Atualizar status de publicação com `useUpdatePost()`
   - Deletar posts com `useDeletePost()`

3. **🔄 Estados de Loading**
   - Indicadores visuais para todas as operações
   - Estados de erro com rollback automático
   - Notificações via toast (Zustand integration)

4. **⚡ Performance**
   - Cache inteligente com invalidação automática
   - Deduplicação de requests
   - Background updates
   - DevTools para debug (ambiente de desenvolvimento)

### Exemplo de Uso Completo

```typescript
// Exemplo extraído do componente demo
function PostManager() {
  // Queries
  const { data: myPosts = [], isLoading } = useMyPosts();
  const { data: profile } = useCurrentUserProfile();
  
  // Mutations
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();
  
  const handleCreatePost = async (postData) => {
    await createPost.mutateAsync(postData);
    // Cache automaticamente atualizado + toast de sucesso
  };
  
  const handleTogglePublish = async (postId, currentStatus) => {
    await updatePost.mutateAsync({
      postId,
      updates: { published: !currentStatus }
    });
    // UI atualizada automaticamente
  };
  
  return (
    <div>
      {/* Interface com loading states, otimistic updates, etc. */}
    </div>
  );
}
```

## 📡 Integração com Supabase Realtime

### Evolução do Hook useRealtimeQuery Existente
O projeto já possui um hook `useRealtimeQuery` que podemos evoluir para usar TanStack Query:

```typescript
// src/hooks/queries/useRealtimePosts.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
import { useEffect } from 'react';
import type { Database } from '@/lib/supabase/types';

type Post = Database['public']['Tables']['posts']['Row'];

export function useRealtimePosts() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  
  // Query base usando TanStack Query
  const query = useQuery({
    queryKey: ['posts'],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });
  
  // Subscription em tempo real (baseado no hook existente)
  useEffect(() => {
    const channel = supabase
      .channel('posts_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts'
      }, (payload) => {
        // Atualização granular baseada no evento
        if (payload.eventType === 'INSERT') {
          queryClient.setQueryData(['posts'], (old: Post[] = []) => [
            payload.new as Post,
            ...old
          ]);
        } else if (payload.eventType === 'UPDATE') {
          queryClient.setQueryData(['posts'], (old: Post[] = []) =>
            old.map(post => 
              post.id === payload.new.id ? payload.new as Post : post
            )
          );
        } else if (payload.eventType === 'DELETE') {
          queryClient.setQueryData(['posts'], (old: Post[] = []) =>
            old.filter(post => post.id !== payload.old.id)
          );
        }
        
        // Também invalida para garantir consistência
        queryClient.invalidateQueries(['posts']);
      })
      .subscribe();
    
    return () => {
      channel.unsubscribe();
    };
  }, [queryClient, supabase]);
  
  return query;
}
```

### Hook Genérico para Realtime (Evoluindo o Existente)
```typescript
// src/hooks/queries/useRealtimeQuery.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
import { useEffect } from 'react';
import type { Database } from '@/lib/supabase/types';

type TableName = keyof Database['public']['Tables'];

interface RealtimeQueryOptions<T> {
  table: TableName;
  queryKey: string[];
  select?: string;
  filters?: { column: string; value: any }[];
  orderBy?: { column: string; ascending?: boolean };
}

export function useRealtimeQuery<T>({
  table,
  queryKey,
  select = '*',
  filters = [],
  orderBy
}: RealtimeQueryOptions<T>) {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  
  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<T[]> => {
      let query = supabase.from(table).select(select);
      
      // Aplicar filtros
      filters.forEach(filter => {
        query = query.eq(filter.column, filter.value);
      });
      
      // Aplicar ordenação
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as T[];
    },
  });
  
  // Subscription realtime
  useEffect(() => {
    const channel = supabase
      .channel(`${table}_realtime`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table
      }, (payload) => {
        // Atualização otimizada do cache
        if (payload.eventType === 'INSERT') {
          queryClient.setQueryData(queryKey, (old: T[] = []) => [
            payload.new as T,
            ...old
          ]);
        } else if (payload.eventType === 'UPDATE') {
          queryClient.setQueryData(queryKey, (old: T[] = []) =>
            old.map(item => 
              (item as any).id === payload.new.id ? payload.new as T : item
            )
          );
        } else if (payload.eventType === 'DELETE') {
          queryClient.setQueryData(queryKey, (old: T[] = []) =>
            old.filter(item => (item as any).id !== payload.old.id)
          );
        }
        
        // Invalidar queries relacionadas
        queryClient.invalidateQueries([table]);
      })
      .subscribe();
    
    return () => {
      channel.unsubscribe();
    };
  }, [table, queryKey, queryClient, supabase]);
  
  return query;
}
```

**Uso do Hook Genérico:**
```typescript
// Posts com realtime
const { data: posts, isLoading } = useRealtimeQuery<Post>({
  table: 'posts',
  queryKey: ['posts'],
  orderBy: { column: 'created_at', ascending: false }
});

// Comentários de um post específico
const { data: comments } = useRealtimeQuery<Comment>({
  table: 'comments',
  queryKey: ['comments', postId],
  filters: [{ column: 'post_id', value: postId }],
  orderBy: { column: 'created_at', ascending: true }
});
```

### Integração com Hook useSupabaseUser Existente
O projeto já possui um hook `useSupabaseUser` que sincroniza perfil Clerk com Supabase. Podemos evoluí-lo:

```typescript
// src/hooks/queries/useSupabaseProfile.ts
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useSupabase } from '@/hooks/useSupabase';
import type { Database } from '@/lib/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export function useSupabaseProfile() {
  const { user, isLoaded } = useUser();
  const supabase = useSupabase();
  
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async (): Promise<Profile> => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // Tenta buscar perfil existente
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (existingProfile) {
        return existingProfile;
      }
      
      // Se não existe, cria novo perfil
      const { data: newProfile, error } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          full_name: user.fullName || '',
          avatar_url: user.imageUrl || ''
        })
        .select()
        .single();
      
      if (error) throw error;
      return newProfile;
    },
    enabled: isLoaded && !!user?.id,
  });
}
```

**Migração do Hook Existente:**
```typescript
// ❌ Hook antigo (useState)
const { profile, loading } = useSupabaseUser();

// ✅ Novo hook (TanStack Query)
const { data: profile, isLoading } = useSupabaseProfile();
```

## 🎯 Integração com Zustand

### Componente Híbrido
```typescript
// src/components/UserProfile.tsx
import { useUser } from '@/hooks/queries/useUser';
import { useUpdateUser } from '@/hooks/mutations/useUpdateUser';
import { useTheme } from '@/store'; // Zustand

export function UserProfile({ userId }: { userId: string }) {
  const theme = useTheme(); // Zustand UI state
  const { data: user, isLoading } = useUser(userId); // TanStack Query
  const updateUser = useUpdateUser(); // TanStack Query + Zustand
  
  const handleUpdate = (newData: any) => {
    updateUser.mutate({ userId, data: newData });
  };
  
  if (isLoading) return <div>Carregando...</div>;
  
  return (
    <div className={`profile ${theme}`}>
      <h1>{user.name}</h1>
      <button onClick={() => handleUpdate({ name: 'Novo Nome' })}>
        {updateUser.isLoading ? 'Atualizando...' : 'Atualizar'}
      </button>
    </div>
  );
}
```

## 🗂️ Estrutura de Hooks

```
src/hooks/
├── queries/              # Hooks de leitura
│   ├── useUser.ts
│   ├── usePosts.ts
│   ├── useComments.ts
│   └── useNotifications.ts
├── mutations/            # Hooks de escrita
│   ├── useUpdateUser.ts
│   ├── useCreatePost.ts
│   ├── useDeletePost.ts
│   └── useCreateComment.ts
└── api/                  # Funções de API
    ├── users.ts
    ├── posts.ts
    └── comments.ts
```

### Funções de API com Clerk + Supabase
```typescript
// src/hooks/api/profiles.ts
import { useClerkSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export const profilesApi = {
  // Buscar perfil por user_id (usa RLS)
  async getProfile(userId: string): Promise<Profile> {
    const supabase = useClerkSupabaseClient();
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Criar perfil (primeira vez)
  async createProfile(profile: ProfileInsert): Promise<Profile> {
    const supabase = useClerkSupabaseClient();
    
    const { data, error } = await supabase
      .from('profiles')
      .insert(profile)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Atualizar perfil (RLS garante que só atualiza próprio perfil)
  async updateProfile(userId: string, updates: ProfileUpdate): Promise<Profile> {
    const supabase = useClerkSupabaseClient();
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// src/hooks/api/posts.ts
type Post = Database['public']['Tables']['posts']['Row'];
type PostInsert = Database['public']['Tables']['posts']['Insert'];
type PostUpdate = Database['public']['Tables']['posts']['Update'];

export const postsApi = {
  // Buscar posts (RLS aplica filtros automaticamente)
  async getPosts(): Promise<Post[]> {
    const supabase = useClerkSupabaseClient();
    
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },
  
  // Buscar posts publicados (área pública)
  async getPublishedPosts(): Promise<Post[]> {
    const supabase = useClerkSupabaseClient();
    
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },
  
  // Criar post (RLS valida permissão)
  async createPost(post: PostInsert): Promise<Post> {
    const supabase = useClerkSupabaseClient();
    
    const { data, error } = await supabase
      .from('posts')
      .insert(post)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Atualizar post (RLS garante que só atualiza próprios posts)
  async updatePost(postId: string, updates: PostUpdate): Promise<Post> {
    const supabase = useClerkSupabaseClient();
    
    const { data, error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', postId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Deletar post (RLS garante que só deleta próprios posts)
  async deletePost(postId: string): Promise<void> {
    const supabase = useClerkSupabaseClient();
    
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);
    
    if (error) throw error;
  },
};
```

## 🔧 Gerenciamento de Keys

### Organização de Query Keys
```typescript
// src/lib/query-keys.ts
export const queryKeys = {
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: string) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },
  posts: {
    all: ['posts'] as const,
    lists: () => [...queryKeys.posts.all, 'list'] as const,
    list: (filters: string) => [...queryKeys.posts.lists(), filters] as const,
    details: () => [...queryKeys.posts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.posts.details(), id] as const,
  },
} as const;
```

**Uso:**
```typescript
export function useUser(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => usersApi.getUser(userId),
  });
}
```

## 🚨 Tratamento de Erros

### Error Handling Global
```typescript
// src/lib/query-client.ts
import { QueryCache } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          // Redirecionar para login
          window.location.href = '/auth/sign-in';
          return;
        }
      }
      
      // Toast global de erro via Zustand
      const showToast = useShowToast.getState();
      showToast({
        type: 'error',
        message: 'Algo deu errado. Tente novamente.',
      });
    },
  }),
});
```

### Error Boundary para Queries
```typescript
// src/components/QueryErrorBoundary.tsx
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded">
      <h2 className="text-red-800 font-semibold">Ops! Algo deu errado:</h2>
      <pre className="text-red-600 text-sm mt-2">{error.message}</pre>
      <button 
        onClick={resetErrorBoundary}
        className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Tentar Novamente
      </button>
    </div>
  );
}

export function QueryErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          FallbackComponent={ErrorFallback}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

## 📊 Performance e Otimização

### 1. Configuração de Stale Time
```typescript
// Diferentes stale times para diferentes tipos de dados
const userQuery = useQuery({
  queryKey: ['user', userId],
  queryFn: fetchUser,
  staleTime: 10 * 60 * 1000, // Dados do usuário: 10 minutos
});

const postsQuery = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
  staleTime: 30 * 1000, // Posts: 30 segundos (mais dinâmico)
});
```

### 2. Background Updates
```typescript
const { data, isLoading, isFetching } = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
});

// Só mostra loading no carregamento inicial
if (isLoading) return <Spinner />;

// Indicador de atualização em background
return (
  <div>
    {isFetching && <div className="text-sm text-blue-600">Atualizando...</div>}
    {/* Renderizar dados */}
  </div>
);
```

### 3. Invalidação Seletiva
```typescript
const createPostMutation = useMutation({
  mutationFn: createPost,
  onSuccess: () => {
    // Só invalida posts, não usuários
    queryClient.invalidateQueries(['posts']);
  },
});
```

## 🧪 Testes

### Configuração para Testes
```typescript
// src/test-utils/query-test-utils.ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithQuery(ui: React.ReactElement) {
  const testQueryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  );
}
```

### Testando Queries
```typescript
test('user profile carrega corretamente', async () => {
  const queryClient = createTestQueryClient();
  
  // Pré-popular cache
  queryClient.setQueryData(['user', 'test-id'], mockUser);
  
  const { findByText } = renderWithQuery(<UserProfile userId="test-id" />);
  
  expect(await findByText(mockUser.name)).toBeInTheDocument();
});
```

## 🎛️ DevTools

### React Query DevTools
```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Apenas em desenvolvimento
{process.env.NODE_ENV === 'development' && (
  <ReactQueryDevtools initialIsOpen={false} />
)}
```

As DevTools oferecem:
- Visualização do cache
- Timeline de queries
- Debugging de mutations
- Estados de loading/error
- Invalidação manual

## 🚨 Boas Práticas

### 1. **Separação Clara de Responsabilidades**
```typescript
// ✅ Zustand para estado do cliente
const theme = useTheme();
const showToast = useShowToast();

// ✅ TanStack Query para dados do servidor
const { data: user } = useUser(userId);
const { data: posts } = usePosts();
```

### 2. **Query Keys Consistentes**
```typescript
// ✅ Bom - estrutura hierárquica
['users', 'list', filters]
['users', 'detail', userId]
['posts', 'list', category]

// ❌ Ruim - inconsistente
['usersList', filters]
['user-detail', userId]
['posts-by-category', category]
```

### 3. **Error Handling Apropriado**
```typescript
// ✅ Handle específico por componente
const { data, error, isError } = useUser(userId);

if (isError) {
  return <ErrorComponent error={error} />;
}
```

### 4. **Background Updates Inteligentes**
```typescript
// ✅ Diferentes estratégias para diferentes dados
const userQuery = useQuery({
  // Dados críticos - atualizar sempre
  refetchOnWindowFocus: true,
  staleTime: 0,
});

const statisticsQuery = useQuery({
  // Dados estatísticos - menos críticos
  refetchOnWindowFocus: false,
  staleTime: 15 * 60 * 1000, // 15 minutos
});
```

## 🔄 Migração do Zustand

### Estratégia de Migração
1. **Manter stores Zustand atuais** - para estado do cliente
2. **Identificar dados do servidor** - nos stores Zustand
3. **Criar hooks TanStack Query** - para esses dados
4. **Migrar componentes gradualmente**
5. **Remover dados do servidor do Zustand**

### Exemplo de Migração
```typescript
// ❌ Antes - tudo no Zustand
const useAppStore = create((set) => ({
  users: [], // Dado do servidor - migrar
  theme: 'light', // Estado do cliente - manter
  isLoading: false, // TanStack Query gerencia
  fetchUsers: async () => { /* ... */ } // Remover
}));

// ✅ Depois - separação clara
// Zustand - só estado do cliente
const useUIStore = create((set) => ({
  theme: 'light',
  sidebarOpen: true,
}));

// TanStack Query - dados do servidor
const { data: users, isLoading } = useUsers();
```

## 📚 Recursos Adicionais

### Links Úteis
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [Query Key Factories](https://tkdodo.eu/blog/effective-react-query-keys)

### Integrações
- **Supabase**: Cliente automático com RLS
- **Zustand**: Estado do cliente complementar
- **Next.js**: SSR e API Routes
- **TypeScript**: Tipagem completa

### Patterns Avançados
- **Infinite Queries**: Paginação infinita
- **Parallel Queries**: Múltiplas queries simultâneas
- **Dependent Queries**: Queries condicionais
- **Prefetching**: Pré-carregamento inteligente

## ✅ Status da Implementação

### 🎉 **COMPLETO - Pronto para Uso!**

O TanStack Query está **totalmente implementado** e funcional no template:

#### ✅ **O que está Funcionando:**
- **Dependencies**: `@tanstack/react-query` + `@tanstack/react-query-devtools` instaladas
- **Configuration**: QueryClient configurado em `/src/lib/query-client.ts`
- **Provider**: Integrado em `/src/app/providers.tsx` com DevTools
- **Query Hooks**: Implementados em `/src/hooks/queries/`
  - `useUserProfile()`, `useCurrentUserProfile()`
  - `usePosts()`, `useMyPosts()`, `usePublishedPosts()`
- **Mutation Hooks**: Implementados em `/src/hooks/mutations/`
  - `useUpdateProfile()`, `useCreatePost()`, `useUpdatePost()`, `useDeletePost()`
- **Demo Component**: `/src/components/TanStackQuery/TanStackQueryDemo.tsx`
- **Demo Page**: `/tanstack-query` no menu de navegação
- **Integration**: Supabase RLS + Clerk JWT + Zustand toasts

#### 🚀 **Recursos Ativos:**
- **Type Safety**: Tipagem completa com Supabase types
- **RLS Security**: Integração automática com Row Level Security
- **Optimistic Updates**: Updates otimistas com rollback
- **Cache Management**: Invalidação e background updates
- **Error Handling**: Toast notifications via Zustand
- **DevTools**: React Query DevTools em desenvolvimento

#### 🎯 **Como Usar:**
1. **Ver Demo**: Acesse `/tanstack-query` no template
2. **Usar Hooks**: Import dos hooks em `/src/hooks/queries/` e `/src/hooks/mutations/`
3. **Seguir Patterns**: Baseado na documentação e exemplos do demo

### 🏃‍♂️ **Para Começar Agora:**
Não há passos necessários - tudo já está configurado! Acesse `/tanstack-query` para ver a implementação completa funcionando.

TanStack Query + Zustand oferece a combinação perfeita para gerenciamento de estado moderno, mantendo a simplicidade sem sacrificar funcionalidades avançadas!