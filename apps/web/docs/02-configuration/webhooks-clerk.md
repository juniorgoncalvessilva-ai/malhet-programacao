# Configuração de Webhooks do Clerk

Este guia explica como configurar webhooks do Clerk para sincronizar automaticamente dados de usuários com o banco de dados Supabase.

## Visão Geral

Os webhooks do Clerk permitem que sua aplicação seja notificada automaticamente quando eventos relacionados a usuários ocorrem (criação, atualização, exclusão). Isso garante que os dados de usuário permaneçam sincronizados entre o Clerk e o Supabase.

## 1. Configurar Variáveis de Ambiente

Adicione a seguinte variável de ambiente ao seu arquivo `.env.local`:

```bash
CLERK_WEBHOOK_SECRET=whsec_sua_chave_secreta_webhook_aqui
```

## 2. Configurar Webhook no Painel do Clerk

1. Acesse o [Painel do Clerk](https://dashboard.clerk.com/)
2. Navegue para **Webhooks** na barra lateral
3. Clique em **Add Endpoint**
4. Configure o webhook:
   - **URL do Endpoint**: `https://seudominio.com/api/webhooks/clerk`
   - **Eventos para escutar**:
     - `user.created`
     - `user.updated` 
     - `user.deleted`

5. Copie o **Signing Secret** e adicione ao seu `.env.local` como `CLERK_WEBHOOK_SECRET`

## 3. Endpoint do Webhook

O endpoint do webhook já está implementado em `/api/webhooks/clerk` e processa:

- **user.created**: Cria um novo perfil na tabela `profiles`
- **user.updated**: Atualiza dados do perfil existente
- **user.deleted**: Remove o perfil do banco de dados

### Implementação do Endpoint

```typescript
// src/app/api/webhooks/clerk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Verificação de assinatura e processamento de eventos
  // Sincronização automática com Supabase
}
```

## 4. Esquema do Banco de Dados

O webhook sincroniza dados para a tabela `profiles` com a seguinte estrutura:

```sql
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

### Campos Sincronizados

- **user_id**: ID único do usuário no Clerk
- **full_name**: Nome completo (combinação de first_name + last_name)
- **avatar_url**: URL da imagem de perfil
- **bio**: Biografia do usuário (campo opcional)

## 5. Eventos Processados

### user.created
Disparado quando um novo usuário se registra:
```json
{
  "type": "user.created",
  "data": {
    "id": "user_123",
    "first_name": "João",
    "last_name": "Silva",
    "image_url": "https://...",
    "email_addresses": [...]
  }
}
```

### user.updated
Disparado quando dados do usuário são alterados:
```json
{
  "type": "user.updated",
  "data": {
    "id": "user_123",
    "first_name": "João Carlos",
    "last_name": "Silva",
    "image_url": "https://..."
  }
}
```

### user.deleted
Disparado quando um usuário é excluído:
```json
{
  "type": "user.deleted",
  "data": {
    "id": "user_123"
  }
}
```

## 6. Segurança

A implementação do webhook inclui:

- **Verificação de assinatura** usando o secret do webhook
- **Cliente administrativo** com chave de role de serviço
- **Tratamento de erros** com logs adequados
- **Validação de payload** para eventos esperados

### Verificação de Assinatura

```typescript
const webhook = new Webhook(webhookSecret);
const event = webhook.verify(body, {
  'svix-id': svix_id,
  'svix-timestamp': svix_timestamp,
  'svix-signature': svix_signature,
});
```

## 7. Testando o Webhook

### Teste Manual
1. Crie uma nova conta de usuário através do fluxo de autenticação Clerk
2. Verifique na tabela `profiles` do Supabase se o usuário foi criado
3. Atualize o perfil do usuário no painel do Clerk
4. Verifique se as alterações foram sincronizadas no Supabase

### Teste com Logs
Monitore os logs do servidor para verificar o processamento dos webhooks:

```bash
# Em desenvolvimento
npm run dev

# Verifique os logs no terminal para mensagens como:
# "User profile created successfully: user_123"
# "User profile updated successfully: user_123"
```

## 8. Desenvolvimento Local

Para testar localmente, você pode usar ferramentas como:

- [ngrok](https://ngrok.com/) para expor seu servidor local
- [Ferramentas de teste de webhook do Clerk](https://clerk.com/docs/webhooks/overview#testing-webhooks)

### Exemplo com ngrok:
```bash
# Instalar ngrok
npm install -g ngrok

# Expor porta local
ngrok http 3000

# Use a URL do ngrok na configuração do webhook Clerk
# https://sua-url-ngrok.ngrok.io/api/webhooks/clerk
```

## 9. Solução de Problemas

### Problemas Comuns

1. **Webhook não está sendo chamado**
   - Verifique se o endpoint está acessível da internet
   - Confirme se a URL no painel do Clerk está correta
   - Certifique-se de que os eventos corretos estão selecionados

2. **Erro de verificação de assinatura**
   - Verifique se `CLERK_WEBHOOK_SECRET` corresponde ao valor no painel
   - Confirme se a variável de ambiente está sendo carregada corretamente

3. **Erros de banco de dados**
   - Verifique se a chave de role de serviço do Supabase tem permissões adequadas
   - Confirme se a tabela `profiles` existe e tem a estrutura correta
   - Verifique os logs do servidor para mensagens de erro específicas

### Comandos de Debug

```bash
# Verificar se o webhook endpoint responde
curl -X POST https://seudominio.com/api/webhooks/clerk

# Verificar logs em tempo real (desenvolvimento)
npm run dev -- --turbo

# Testar conexão com Supabase
npx supabase status
```

## 10. Deploy em Produção

Para produção, certifique-se de:

1. **Configurar domínio de produção** no webhook do Clerk
2. **Usar HTTPS** para o endpoint do webhook
3. **Configurar variáveis de ambiente** no serviço de deploy
4. **Monitorar logs** para verificar funcionamento correto
5. **Testar sincronização** após deploy
