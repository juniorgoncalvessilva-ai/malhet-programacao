# 🔄 Guia de Integração TanStack Query para AI Agents

## ⚠️ IMPORTANTE: TanStack Query já está IMPLEMENTADO!

**TanStack Query está totalmente configurado e funcional neste projeto.** Este guia orienta AI agents sobre como **usar e estender** a implementação existente, não como implementar do zero.

### ✅ O que já está pronto:
- QueryClient configurado em `/src/lib/query-client.ts`
- Provider integrado em `/src/app/providers.tsx`
- Hooks de query em `/src/hooks/queries/`
- Hooks de mutation em `/src/hooks/mutations/`
- Demo funcional em `/tanstack-query`

## Contexto
Este projeto usa **TanStack Query** para gerenciamento de estado do servidor junto com **Zustand** para estado do cliente. Como AI agent, você deve seguir os padrões existentes ao adicionar novas features.

## 🎯 State Separation Strategy

### ✅ Continue Using Zustand For:
- UI state (theme, sidebar, modals, toasts)
- User preferences and app settings  
- Authentication status (derived from Clerk)
- Local application state
- Client-side notifications

### ✅ Use TanStack Query For:
- API data fetching and caching
- User profiles and server data
- Posts, comments, any server-sourced data
- Real-time data synchronization
- Background updates and refetching
- Optimistic updates for better UX

## 📦 Como Usar a Implementação Existente

### 1. Verificar a Configuração Atual

```typescript
// ✅ JÁ IMPLEMENTADO em src/lib/query-client.ts
import { queryClient } from '@/lib/query-client';

// Configuração existente:
// - staleTime: 5 minutos
// - gcTime: 10 minutos (v5)
// - retry: lógica inteligente para erros
// - refetchOnWindowFocus: false
```

### 2. Usar os Hooks Existentes

```typescript
// ✅ HOOKS JÁ DISPONÍVEIS

// Queries (src/hooks/queries/)
import { useUserProfile, useCurrentUserProfile } from '@/hooks/queries/useUser';
import { usePosts, useMyPosts, usePublishedPosts } from '@/hooks/queries/usePosts';

// Mutations (src/hooks/mutations/)
import { useUpdateProfile } from '@/hooks/mutations/useProfile';
import { useCreatePost, useUpdatePost, useDeletePost } from '@/hooks/mutations/usePosts';
```

## 🔧 Padrões para Implementar Novas Features

### ⚠️ SEMPRE siga os padrões existentes ao criar novos hooks!

### Pattern 1: Criar Nova Query Hook (seguindo padrão existente)

```typescript
// ✅ EXEMPLO: Adicionar query para comentários seguindo o padrão dos posts

// src/hooks/queries/useComments.ts
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@clerk/nextjs';
import type { Database } from '@/lib/supabase/types';

// 1. Usar tipos do Supabase
type Comment = Database['public']['Tables']['comments']['Row'];

// 2. Seguir convenção de nomenclatura
export function useComments(postId: string) {
  const supabase = useSupabase();
  
  return useQuery({
    queryKey: ['comments', postId], // Padrão: [recurso, identificador]
    queryFn: async (): Promise<Comment[]> => {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!postId, // Padrão: validar parâmetros
  });
}

// 3. Variações específicas (como em usePosts)
export function useMyComments() {
  const { user } = useUser();
  const supabase = useSupabase();
  
  return useQuery({
    queryKey: ['comments', 'my', user?.id],
    queryFn: async (): Promise<Comment[]> => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}
```

### Pattern 2: Criar Nova Mutation (seguindo padrão existente)

```typescript
// ✅ EXEMPLO: Adicionar mutation para comentários seguindo o padrão dos posts

// src/hooks/mutations/useComments.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useShowToast } from '@/store'; // SEMPRE usar toast do Zustand
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@clerk/nextjs';
import type { Database } from '@/lib/supabase/types';

type CommentInsert = Database['public']['Tables']['comments']['Insert'];
type Comment = Database['public']['Tables']['comments']['Row'];

export function useCreateComment() {
  const queryClient = useQueryClient();
  const showToast = useShowToast(); // Padrão: toast via Zustand
  const supabase = useSupabase();
  const { user } = useUser();
  
  return useMutation({
    mutationFn: async (newComment: Omit<CommentInsert, 'user_id'>): Promise<Comment> => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('comments')
        .insert({
          ...newComment,
          user_id: user.id, // Sempre usar ID do Clerk
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (createdComment) => {
      // Padrão: invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['comments', createdComment.post_id] });
      
      // Padrão: mostrar toast de sucesso
      showToast({
        type: 'success',
        message: 'Comentário adicionado com sucesso!'
      });
    },
    onError: (error: any) => {
      // Padrão: mostrar toast de erro
      showToast({
        type: 'error', 
        message: error.message || 'Falha ao adicionar comentário'
      });
    },
  });
}
```

### Pattern 3: List with Optimistic Updates

```typescript
// src/hooks/queries/usePosts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
import { useShowToast } from '@/store';

interface Post {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
}

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
      return data;
    },
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  const supabase = useSupabase();
  
  return useMutation({
    mutationFn: async (newPost: Omit<Post, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('posts')
        .insert(newPost)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: async (newPost) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['posts']);
      
      // Snapshot previous value
      const previousPosts = queryClient.getQueryData(['posts']);
      
      // Optimistically update the cache
      queryClient.setQueryData(['posts'], (old: Post[] = []) => [
        {
          ...newPost,
          id: 'temp-' + Date.now(),
          created_at: new Date().toISOString()
        },
        ...old
      ]);
      
      return { previousPosts };
    },
    onError: (error, newPost, context) => {
      // Rollback on error
      if (context?.previousPosts) {
        queryClient.setQueryData(['posts'], context.previousPosts);
      }
      showToast({
        type: 'error',
        message: 'Failed to create post'
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries(['posts']);
    },
  });
}
```

### Pattern 4: Real-time Integration

```typescript
// src/hooks/queries/useRealtimePosts.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
import { useEffect } from 'react';

export function useRealtimePosts() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  
  // Base query
  const query = useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
  
  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('posts_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts'
      }, (payload) => {
        // Invalidate and refetch on any change
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

### Pattern 5: Component Integration

```typescript
// src/components/UserProfile.tsx
import { useUser } from '@/hooks/queries/useUser';
import { useUpdateUser } from '@/hooks/mutations/useUpdateUser';
import { useTheme } from '@/store'; // Zustand for UI state

interface UserProfileProps {
  userId: string;
}

export function UserProfile({ userId }: UserProfileProps) {
  const theme = useTheme(); // Zustand UI state
  const { data: user, isLoading, error } = useUser(userId); // TanStack Query
  const updateUserMutation = useUpdateUser(); // TanStack Query + Zustand
  
  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }
  
  if (error) {
    return (
      <div className="text-red-500">
        Error loading user: {error.message}
      </div>
    );
  }
  
  const handleUpdateName = () => {
    updateUserMutation.mutate({
      userId,
      data: { name: 'Updated Name' }
    });
  };
  
  return (
    <div className={`profile ${theme}`}>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      
      <button 
        onClick={handleUpdateName}
        disabled={updateUserMutation.isLoading}
        className="btn-primary"
      >
        {updateUserMutation.isLoading ? 'Updating...' : 'Update Name'}
      </button>
    </div>
  );
}
```

## 🔑 Query Key Management

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

// Usage
export function useUser(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => fetchUser(userId),
  });
}
```

## 🚨 Error Handling Patterns

### Global Error Handling

```typescript
// src/lib/query-client.ts
import { AxiosError } from 'axios';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // Global error handling
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          // Handle auth errors globally
          window.location.href = '/auth/sign-in';
          return;
        }
      }
      
      // Show generic error toast
      const showToast = useShowToast.getState();
      showToast({
        type: 'error',
        message: 'Something went wrong. Please try again.',
      });
    },
  }),
});
```

### Component Error Boundaries

```typescript
// src/components/QueryErrorBoundary.tsx
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="error-fallback">
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
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

## 🔄 Migration Strategy

### 1. Keep Existing Zustand Stores
Don't change current UI and client state management:

```typescript
// ✅ Keep these Zustand patterns
const theme = useTheme();
const showToast = useShowToast();
const sidebarOpen = useSidebarOpen();
const userPreferences = usePreferences();
```

### 2. Replace Server Data with TanStack Query

```typescript
// ❌ Remove from Zustand stores
interface AppStore {
  users: User[]; // Remove - use TanStack Query
  posts: Post[]; // Remove - use TanStack Query
  isLoadingUsers: boolean; // Remove - TanStack Query handles loading
}

// ✅ Use TanStack Query instead
const { data: users, isLoading } = useUsers();
const { data: posts } = usePosts();
```

### 3. Migrate Gradually

1. **Start with read-only data** (GET requests)
2. **Add mutations** (POST, PUT, DELETE)
3. **Add real-time subscriptions**
4. **Remove server data from Zustand stores**

## 🧪 Testing Patterns

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

// In tests
test('user profile loads correctly', async () => {
  const queryClient = createTestQueryClient();
  
  // Pre-populate cache
  queryClient.setQueryData(['user', 'test-id'], mockUser);
  
  const { findByText } = renderWithQuery(<UserProfile userId="test-id" />);
  
  expect(await findByText(mockUser.name)).toBeInTheDocument();
});
```

## 📊 Performance Best Practices

### 1. Stale Time Configuration

```typescript
// Different stale times for different data types
const userQuery = useQuery({
  queryKey: ['user', userId],
  queryFn: fetchUser,
  staleTime: 10 * 60 * 1000, // User data: 10 minutes
});

const postsQuery = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
  staleTime: 30 * 1000, // Posts: 30 seconds (more dynamic)
});
```

### 2. Background Updates

```typescript
// Show cached data immediately, update in background
const { data, isLoading, isFetching } = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
});

// Only show loading on initial load
if (isLoading) return <Spinner />;

// Show background update indicator
return (
  <div>
    {isFetching && <div className="text-sm">Updating...</div>}
    {/* Render data */}
  </div>
);
```

### 3. Selective Invalidation

```typescript
// Invalidate specific queries after mutations
const createPostMutation = useMutation({
  mutationFn: createPost,
  onSuccess: () => {
    // Only invalidate posts, not users
    queryClient.invalidateQueries(['posts']);
  },
});
```

## 🔗 Integration with Existing Features

### With Supabase RLS

```typescript
export function useUserPosts(userId: string) {
  const supabase = useSupabase(); // Uses Clerk token automatically
  
  return useQuery({
    queryKey: ['posts', 'user', userId],
    queryFn: async () => {
      // RLS automatically filters based on Clerk user
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}
```

### With Internationalization

```typescript
export function useLocalizedPosts() {
  const locale = useLocale(); // Zustand locale store
  
  return useQuery({
    queryKey: ['posts', 'localized', locale],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('language', locale);
      
      if (error) throw error;
      return data;
    },
  });
}
```

## 📁 Recommended File Structure

```
src/
├── hooks/
│   ├── queries/
│   │   ├── useUser.ts
│   │   ├── usePosts.ts
│   │   └── useComments.ts
│   ├── mutations/
│   │   ├── useUpdateUser.ts
│   │   ├── useCreatePost.ts
│   │   └── useDeletePost.ts
│   └── api/
│       ├── users.ts
│       ├── posts.ts
│       └── comments.ts
├── lib/
│   ├── query-client.ts
│   └── query-keys.ts
└── store/ (existing Zustand stores)
    ├── ui-store.ts
    ├── app-store.ts
    └── locale-store.ts
```

## 🎯 Resumo para AI Agents

### ✅ O que JÁ ESTÁ PRONTO:
1. **TanStack Query está IMPLEMENTADO** - não precisa instalar ou configurar
2. **Hooks existentes** em `/src/hooks/queries/` e `/src/hooks/mutations/`
3. **Demo funcional** em `/tanstack-query` mostrando todos os padrões
4. **Integração completa** com Supabase RLS + Clerk JWT + Zustand

### 📋 Checklist ao Adicionar Novas Features:

#### 1. Para Queries:
- [ ] Criar em `/src/hooks/queries/useNomeDoRecurso.ts`
- [ ] Usar tipos do Supabase: `type X = Database['public']['Tables']['tabela']['Row']`
- [ ] Seguir padrão de queryKey: `['recurso', identificador]`
- [ ] Usar `useSupabase()` para cliente
- [ ] Adicionar `enabled` para validar parâmetros

#### 2. Para Mutations:
- [ ] Criar em `/src/hooks/mutations/useNomeDoRecurso.ts`
- [ ] Sempre usar `useShowToast()` do Zustand para feedback
- [ ] Usar `useUser()` do Clerk para autenticação
- [ ] Invalidar queries relacionadas no `onSuccess`
- [ ] Implementar tratamento de erro no `onError`

#### 3. Para Componentes:
- [ ] Importar hooks de `/src/hooks/queries/` ou `/src/hooks/mutations/`
- [ ] Usar estados de loading: `isLoading`, `isPending`
- [ ] Mostrar erros apropriadamente
- [ ] Seguir padrões do demo em `/src/components/TanStackQuery/TanStackQueryDemo.tsx`

### ⚠️ NUNCA:
- ❌ Reinstalar TanStack Query (já está instalado)
- ❌ Recriar QueryClient (use o existente em `/src/lib/query-client.ts`)
- ❌ Modificar provider (já está configurado em `/src/app/providers.tsx`)
- ❌ Usar fetch direto (sempre use hooks do TanStack Query)
- ❌ Armazenar dados do servidor no Zustand (use TanStack Query)

### ✅ SEMPRE:
- ✅ Seguir os padrões dos hooks existentes
- ✅ Usar TypeScript com tipos do Supabase
- ✅ Integrar com Zustand para toasts
- ✅ Respeitar RLS do Supabase com Clerk JWT
- ✅ Verificar o demo antes de implementar

## 📚 Referências

- [Demo Funcional](/tanstack-query) - **VER PRIMEIRO!**
- [Documentação Completa](/docs/05-features/tanstack-query.md)
- [Hooks Implementados](/src/hooks/queries/ e /src/hooks/mutations/)
- [Componente Demo](/src/components/TanStackQuery/TanStackQueryDemo.tsx)