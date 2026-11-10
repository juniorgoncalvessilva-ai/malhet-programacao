# Configuração Clerk + Supabase para Desenvolvimento Local

## Visão Geral
Este guia explica como configurar a autenticação Clerk com Supabase localmente.

## Status Atual ✅
- ✅ Variáveis de ambiente configuradas
- ✅ Integração do cliente Supabase com tokens Clerk
- ✅ Políticas RLS configuradas para IDs de usuário Clerk
- ✅ Migrações de banco com funções de auth compatíveis com Clerk

## Passos Necessários para Completar a Configuração

### 1. Configurar Template JWT do Clerk

1. Acesse o [Painel Clerk](https://dashboard.clerk.dev/)
2. Navegue para **Configure → JWT Templates**
3. Crie um novo template com o nome `supabase`
4. Use esta configuração:

```json
{
  "aud": "authenticated",
  "exp": "{{user.created_at | date: '%s' | plus: 3600}}",
  "iat": "{{user.created_at | date: '%s'}}",
  "iss": "https://seu-dominio-clerk",
  "sub": "{{user.id}}",
  "email": "{{user.primary_email_address.email_address}}",
  "phone": "{{user.primary_phone_number.phone_number}}",
  "app_metadata": {
    "provider": "clerk",
    "providers": ["clerk"]
  },
  "user_metadata": {
    "full_name": "{{user.full_name}}",
    "first_name": "{{user.first_name}}",
    "last_name": "{{user.last_name}}"
  },
  "role": "authenticated"
}
```

### 2. Testar a Integração

Inicie seus servidores de desenvolvimento:

```bash
# Terminal 1: Iniciar Supabase
npm run db:start

# Terminal 2: Iniciar Next.js
npm run dev
```

Navegue para `/auth/sign-in` e teste a autenticação.

## Como Funciona

### Fluxo de Autenticação
1. **Usuário faz login** através do Clerk
2. **Clerk gera JWT** usando o template `supabase`
3. **Requisições do frontend** incluem JWT no cabeçalho Authorization
4. **Supabase valida JWT** e aplica políticas RLS
5. **Consultas ao banco** são filtradas pelo ID do usuário do JWT

### Componentes Principais

#### Cliente Supabase (`src/lib/supabase/server.ts`)
```typescript
const clerkToken = await getToken({
  template: 'supabase'  // Usa template JWT do Clerk
});

headers.set('Authorization', `Bearer ${clerkToken}`);
```

#### Políticas RLS (`supabase/migrations/`)
```sql
-- Usa claim 'sub' do JWT (ID do usuário Clerk)
COALESCE(
  auth.jwt() ->> 'sub',
  current_setting('request.jwt.claim.sub', true)
) = user_id
```

## URLs de Desenvolvimento

- **App Next.js**: http://localhost:3000
- **API Supabase**: http://127.0.0.1:54331
- **Supabase Studio**: http://127.0.0.1:54333
- **Banco de Dados**: postgresql://postgres:postgres@127.0.0.1:54332/postgres

## Solução de Problemas

### Problemas Comuns

1. **Template JWT Não Encontrado**
   - Certifique-se que o nome do template é exatamente `supabase`
   - Verifique se o template está publicado/ativo no Clerk

2. **Erros de Política RLS**
   - Verifique se o token JWT inclui o claim `sub` correto
   - Confirme que user_id corresponde ao formato de ID do Clerk

3. **Erros de CORS**
   - Certifique-se que a URL do Supabase no env corresponde à instância rodando
   - Verifique configuração de domínio do Clerk

### Comandos de Debug

```bash
# Verificar status do Supabase
supabase status

# Ver logs do banco
docker logs supabase_db_cluster-3

# Testar token JWT (no console do navegador)
const token = await window.Clerk?.getToken({ template: 'supabase' });
console.log(token);
```

## Deploy em Produção

Para produção, você precisará:
1. Configurar Clerk com domínio de produção
2. Configurar projeto Supabase com URL JWKS do Clerk
3. Atualizar variáveis de ambiente
4. Executar migrações no banco de produção

## Variáveis de Ambiente Necessárias

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# URLs de Autenticação
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Supabase Local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54331
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...
```

## Estrutura de Banco de Dados

### Tabela Profiles
```sql
-- Armazena informações adicionais do usuário sincronizadas do Clerk
CREATE TABLE public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL, -- ID do usuário Clerk
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Políticas RLS
```sql
-- Usuários podem ver apenas seu próprio perfil
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (
    COALESCE(
      auth.jwt() ->> 'sub',
      current_setting('request.jwt.claim.sub', true)
    ) = user_id
  );
```

## Integração com TanStack Query

Com a autenticação configurada, os hooks do TanStack Query funcionarão automaticamente:

```typescript
// hooks/queries/useUser.ts
export function useUserProfile(userId: string) {
  const supabase = useSupabase(); // Já inclui token Clerk
  
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
```

## Comandos Úteis

```bash
# Iniciar stack completo
npm run db:start && npm run dev

# Parar Supabase
npm run db:stop

# Reset do banco (apaga dados)
npm run db:reset

# Ver Studio do Supabase
npm run db:studio

# Executar migrações
npm run db:migrate
```