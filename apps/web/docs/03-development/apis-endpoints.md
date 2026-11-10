# 🔌 APIs e Endpoints

Este guia ensina como criar endpoints de API autenticados e não autenticados usando Next.js App Router com autenticação Clerk.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Estrutura de APIs](#estrutura-de-apis)
- [APIs Não Autenticadas](#apis-não-autenticadas)
- [APIs Autenticadas](#apis-autenticadas)
- [Middleware e Segurança](#middleware-e-segurança)
- [Tratamento de Erros](#tratamento-de-erros)
- [Exemplos Práticos](#exemplos-práticos)
- [Melhores Práticas](#melhores-práticas)

## 🎯 Visão Geral

### Tipos de APIs Disponíveis

1. **APIs Públicas** - Acessíveis sem autenticação
   - Localização: `/src/app/api/[nome]/route.ts`
   - Uso: Webhooks, dados públicos, endpoints de saúde

2. **APIs Protegidas** - Requerem autenticação
   - Localização: `/src/app/api/protected/[nome]/route.ts`
   - Uso: Dados do usuário, operações sensíveis

### Estrutura do App Router

```
src/app/api/
├── health/                 # API pública - status do sistema
│   └── route.ts
├── webhooks/               # APIs públicas - webhooks externos
│   ├── clerk/
│   │   └── route.ts
│   └── payment/
│       └── route.ts
└── protected/              # APIs protegidas - requerem autenticação
    ├── user-profile/
    │   └── route.ts
    ├── dashboard-data/
    │   └── route.ts
    └── settings/
        └── route.ts
```

## 🌐 APIs Não Autenticadas

### 1. Criando uma API Pública

**Exemplo: API de Status do Sistema**

```typescript
// src/app/api/health/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Verificações básicas do sistema
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: 'Sistema indisponível' 
      },
      { status: 503 }
    );
  }
}
```

### 2. API de Webhook

**Exemplo: Webhook do Clerk**

```typescript
// src/app/api/webhooks/clerk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    // Verificar assinatura do webhook
    const headerPayload = headers();
    const svixId = headerPayload.get('svix-id');
    const svixTimestamp = headerPayload.get('svix-timestamp');
    const svixSignature = headerPayload.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json(
        { error: 'Headers de webhook inválidos' },
        { status: 400 }
      );
    }

    const payload = await request.text();
    const body = JSON.parse(payload);

    // Verificar webhook
    const wh = new Webhook(webhookSecret);
    const evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });

    // Processar evento
    switch (evt.type) {
      case 'user.created':
        console.log('Novo usuário criado:', evt.data.id);
        // Aqui você pode salvar o usuário no banco de dados
        break;
      
      case 'user.updated':
        console.log('Usuário atualizado:', evt.data.id);
        // Atualizar dados do usuário
        break;
      
      case 'user.deleted':
        console.log('Usuário deletado:', evt.data.id);
        // Remover dados do usuário
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Erro no webhook:', error);
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 400 }
    );
  }
}
```

### 3. API de Dados Públicos

**Exemplo: Lista de Produtos Públicos**

```typescript
// src/app/api/products/public/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Extrair parâmetros de query
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const category = searchParams.get('category');

    // Simular busca de produtos públicos
    const products = [
      {
        id: 1,
        name: 'Produto Demo 1',
        description: 'Descrição do produto demo',
        price: 29.99,
        category: 'eletronicos',
        image: '/images/product1.jpg',
        available: true
      },
      {
        id: 2,
        name: 'Produto Demo 2',
        description: 'Outro produto de demonstração',
        price: 49.99,
        category: 'casa',
        image: '/images/product2.jpg',
        available: true
      }
    ];

    // Filtrar por categoria se especificada
    const filteredProducts = category 
      ? products.filter(p => p.category === category)
      : products;

    // Paginação simples
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    return NextResponse.json({
      products: paginatedProducts,
      pagination: {
        page,
        limit,
        total: filteredProducts.length,
        totalPages: Math.ceil(filteredProducts.length / limit)
      }
    });

  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
```

## 🔒 APIs Autenticadas

### 1. Configuração Básica

Para APIs autenticadas, use sempre a estrutura `/api/protected/`:

```typescript
// src/app/api/protected/[nome]/route.ts
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // ✅ SEMPRE verificar autenticação primeiro
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Acesso não autorizado. Login necessário.' },
        { status: 401 }
      );
    }

    // Continuar com a lógica da API...
    
  } catch (error) {
    console.error('Erro na API protegida:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
```

### 2. API de Perfil do Usuário

**Exemplo Completo: CRUD de Perfil**

```typescript
// src/app/api/protected/user-profile/route.ts
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Buscar dados do perfil
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    // Obter dados completos do usuário
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Montar dados do perfil
    const profile = {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      avatar: user.imageUrl,
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
      
      // Dados adicionais (podem vir do banco de dados)
      preferences: {
        theme: 'dark',
        language: 'pt-BR',
        notifications: true
      },
      
      stats: {
        totalLogins: 42, // Vem do seu banco de dados
        accountAge: Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24)),
        lastActivity: new Date().toISOString()
      }
    };

    return NextResponse.json({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar perfil do usuário' },
      { status: 500 }
    );
  }
}

// POST - Atualizar dados do perfil
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validar dados recebidos
    const allowedFields = ['theme', 'language', 'notifications'];
    const updates = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Aqui você salvaria no banco de dados
    // await updateUserPreferences(userId, updates);

    return NextResponse.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: {
        userId,
        updatedFields: Object.keys(updates),
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar perfil' },
      { status: 500 }
    );
  }
}

// DELETE - Solicitar exclusão de conta
export async function DELETE() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    // Aqui você implementaria a lógica de exclusão
    // - Marcar conta para exclusão
    // - Remover dados sensíveis
    // - Enviar email de confirmação
    
    console.log(`Solicitação de exclusão para usuário: ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Solicitação de exclusão processada',
      data: {
        userId,
        status: 'pending_deletion',
        requestedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erro ao processar exclusão:', error);
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
```

### 3. API de Dados Específicos do Usuário

**Exemplo: Dashboard Personalizado (EXEMPLO - endpoint não implementado)**

```typescript
// Exemplo de implementação para src/app/api/protected/dashboard/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    // Extrair filtros da query
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const metric = searchParams.get('metric') || 'all';

    // Buscar dados específicos do usuário
    // Aqui você faria queries no banco de dados filtradas por userId
    const dashboardData = {
      userId,
      period,
      metrics: {
        totalViews: Math.floor(Math.random() * 10000),
        totalClicks: Math.floor(Math.random() * 1000),
        conversionRate: (Math.random() * 10).toFixed(2) + '%',
        revenue: `R$ ${(Math.random() * 50000).toFixed(2)}`
      },
      
      recentActivity: [
        {
          id: 1,
          action: 'Login realizado',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          type: 'auth'
        },
        {
          id: 2,
          action: 'Dados atualizados',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          type: 'update'
        }
      ],
      
      quickStats: {
        activeProjects: Math.floor(Math.random() * 20),
        pendingTasks: Math.floor(Math.random() * 15),
        completedGoals: Math.floor(Math.random() * 50),
        teamMembers: Math.floor(Math.random() * 10)
      }
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro no dashboard:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar dashboard' },
      { status: 500 }
    );
  }
}

// POST - Criar novo item no dashboard
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validar dados obrigatórios
    if (!body.title || !body.type) {
      return NextResponse.json(
        { error: 'Título e tipo são obrigatórios' },
        { status: 400 }
      );
    }

    // Criar novo item (salvar no banco)
    const newItem = {
      id: Date.now(),
      userId,
      title: body.title,
      description: body.description || '',
      type: body.type,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Aqui você salvaria no banco de dados
    // await createUserItem(newItem);

    return NextResponse.json({
      success: true,
      message: 'Item criado com sucesso',
      data: newItem
    });

  } catch (error) {
    console.error('Erro ao criar item:', error);
    return NextResponse.json(
      { error: 'Erro ao criar item' },
      { status: 500 }
    );
  }
}
```

## 🛡️ Middleware e Segurança

### Configuração do Middleware

O middleware já está configurado para proteger automaticamente rotas `/api/protected/*`:

```typescript
// src/middleware.ts
export default clerkMiddleware(async (auth, req: NextRequest) => {
  const isApiRoute = req.nextUrl.pathname.startsWith('/api');
  
  if (isApiRoute) {
    // Proteger automaticamente rotas /api/protected/*
    if (req.nextUrl.pathname.startsWith('/api/protected')) {
      await auth.protect();
    }
    return;
  }
  
  // Lógica para páginas...
});
```

### Verificações de Segurança

**1. Validação de Entrada**

```typescript
// Exemplo de validação com Zod
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  language: z.enum(['pt-BR', 'en']).optional(),
  notifications: z.boolean().optional()
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validar dados
    const validationResult = UpdateProfileSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;
    // Continuar com dados validados...
    
  } catch (error) {
    // Tratamento de erro...
  }
}
```

**2. Rate Limiting**

```typescript
// Exemplo simples de rate limiting (use uma solução robusta em produção)
const requestCounts = new Map();

function isRateLimited(userId: string, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const userRequests = requestCounts.get(userId) || [];
  
  // Remover requests antigas
  const validRequests = userRequests.filter(time => now - time < windowMs);
  
  if (validRequests.length >= maxRequests) {
    return true;
  }
  
  validRequests.push(now);
  requestCounts.set(userId, validRequests);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar rate limit
    if (isRateLimited(userId)) {
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente em um minuto.' },
        { status: 429 }
      );
    }

    // Continuar com a lógica...
    
  } catch (error) {
    // Tratamento de erro...
  }
}
```

## ⚠️ Tratamento de Erros

### Estrutura Padrão de Resposta

```typescript
// Sucesso
return NextResponse.json({
  success: true,
  data: resultado,
  message: 'Operação realizada com sucesso'
});

// Erro
return NextResponse.json(
  {
    success: false,
    error: 'Mensagem do erro para o usuário',
    code: 'CODIGO_DO_ERRO',
    details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
  },
  { status: statusCode }
);
```

### Códigos de Status HTTP

- **200** - Sucesso
- **201** - Criado com sucesso
- **400** - Dados inválidos
- **401** - Não autenticado
- **403** - Não autorizado (autenticado mas sem permissão)
- **404** - Não encontrado
- **429** - Rate limit excedido
- **500** - Erro interno do servidor

### Exemplo de Tratamento Robusto

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticação
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Acesso negado. Faça login para continuar.',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }

    // 2. Validar dados
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados JSON inválidos',
          code: 'INVALID_JSON'
        },
        { status: 400 }
      );
    }

    // 3. Validar schema
    const validationResult = Schema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados não atendem aos requisitos',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    // 4. Lógica de negócio
    const result = await processBusinessLogic(userId, validationResult.data);

    // 5. Resposta de sucesso
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Operação realizada com sucesso'
    });

  } catch (error) {
    console.error('Erro na API:', error);
    
    // Não vazar detalhes em produção
    const isDev = process.env.NODE_ENV === 'development';
    
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR',
        details: isDev ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
```

## 🎯 Exemplos Práticos

### 1. API de Upload de Arquivo

```typescript
// src/app/api/protected/upload/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido' },
        { status: 400 }
      );
    }

    // Validar tamanho (5MB máximo)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Máximo 5MB.' },
        { status: 400 }
      );
    }

    // Aqui você salvaria o arquivo
    // const fileUrl = await saveFile(file, userId);

    return NextResponse.json({
      success: true,
      message: 'Arquivo enviado com sucesso',
      data: {
        fileName: file.name,
        size: file.size,
        type: file.type,
        // url: fileUrl
      }
    });

  } catch (error) {
    console.error('Erro no upload:', error);
    return NextResponse.json(
      { error: 'Erro ao processar upload' },
      { status: 500 }
    );
  }
}
```

### 2. API de Busca com Filtros

```typescript
// src/app/api/protected/search/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Parâmetros de busca
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const sortBy = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    // Validar parâmetros
    const validSortFields = ['created_at', 'updated_at', 'name', 'relevance'];
    const validOrders = ['asc', 'desc'];
    
    if (!validSortFields.includes(sortBy) || !validOrders.includes(order)) {
      return NextResponse.json(
        { error: 'Parâmetros de ordenação inválidos' },
        { status: 400 }
      );
    }

    // Aqui você faria a busca no banco de dados
    const searchResults = {
      items: [
        // Resultados simulados
        {
          id: 1,
          title: 'Resultado 1',
          description: 'Descrição do resultado',
          category: 'exemplo',
          createdAt: new Date().toISOString(),
          relevance: 0.95
        }
      ],
      pagination: {
        page,
        limit,
        total: 1,
        totalPages: 1
      },
      filters: {
        query,
        category,
        sortBy,
        order
      }
    };

    return NextResponse.json({
      success: true,
      data: searchResults
    });

  } catch (error) {
    console.error('Erro na busca:', error);
    return NextResponse.json(
      { error: 'Erro ao realizar busca' },
      { status: 500 }
    );
  }
}
```

## 🏆 Melhores Práticas

### 1. Estrutura e Organização

```typescript
// ✅ BOM - Estrutura clara
src/app/api/
├── health/route.ts              # Status do sistema
├── webhooks/
│   ├── clerk/route.ts          # Webhook do Clerk
│   └── payment/route.ts        # Webhook de pagamento
├── public/
│   ├── products/route.ts       # Produtos públicos
│   └── categories/route.ts     # Categorias públicas
└── protected/
    ├── user/
    │   ├── profile/route.ts    # Perfil do usuário
    │   └── settings/route.ts   # Configurações
    ├── dashboard/route.ts      # Dashboard
    └── admin/
        ├── users/route.ts      # Admin - usuários
        └── analytics/route.ts  # Admin - analytics
```

### 2. Nomenclatura e Convenções

```typescript
// ✅ BOM - Nomes descritivos
export async function GET() { /* Buscar dados */ }
export async function POST() { /* Criar dados */ }
export async function PUT() { /* Atualizar completamente */ }
export async function PATCH() { /* Atualizar parcialmente */ }
export async function DELETE() { /* Remover dados */ }

// ✅ BOM - Respostas consistentes
return NextResponse.json({
  success: true,
  data: resultado,
  message: 'Mensagem amigável'
});

// ❌ RUIM - Inconsistente
return NextResponse.json(resultado);
```

### 3. Segurança

```typescript
// ✅ BOM - Sempre verificar autenticação primeiro
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  // Continuar...
}

// ✅ BOM - Validar dados de entrada
const validationResult = Schema.safeParse(body);
if (!validationResult.success) {
  return NextResponse.json(
    { error: 'Dados inválidos', details: validationResult.error },
    { status: 400 }
  );
}

// ✅ BOM - Não vazar informações sensíveis
catch (error) {
  console.error('Erro interno:', error); // Log completo
  return NextResponse.json(
    { error: 'Erro interno do servidor' }, // Resposta genérica
    { status: 500 }
  );
}
```

### 4. Performance

```typescript
// ✅ BOM - Paginação para listas grandes
const page = parseInt(searchParams.get('page') || '1');
const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);

// ✅ BOM - Cache quando apropriado
export async function GET() {
  const response = NextResponse.json(data);
  response.headers.set('Cache-Control', 'public, max-age=300'); // 5 minutos
  return response;
}

// ✅ BOM - Timeouts para operações longas
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

try {
  const result = await longRunningOperation({ signal: controller.signal });
  clearTimeout(timeoutId);
  return NextResponse.json(result);
} catch (error) {
  if (error.name === 'AbortError') {
    return NextResponse.json(
      { error: 'Operação demorou muito para ser concluída' },
      { status: 408 }
    );
  }
  throw error;
}
```

### 5. Logging e Monitoramento

```typescript
// ✅ BOM - Logs estruturados
console.log('API chamada', {
  method: request.method,
  url: request.url,
  userId,
  timestamp: new Date().toISOString()
});

// ✅ BOM - Métricas de performance
const startTime = Date.now();
// ... lógica da API ...
const duration = Date.now() - startTime;
console.log(`API executada em ${duration}ms`);
```

## 🔗 Próximos Passos

- **[Autenticação](../05-features/autenticacao.md)** - Configuração avançada do Clerk
- **[Formulários](../05-features/validacao-formularios.md)** - Integração com formulários
- **[Deploy](../06-deployment/)** - Configuração de produção

## 📚 Recursos Adicionais

- [Next.js App Router](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Clerk Authentication](https://clerk.com/docs/nextjs)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [Zod Validation](https://zod.dev/)

---

💡 **Dica**: Sempre teste suas APIs tanto autenticadas quanto não autenticadas usando a página de demonstração em `/api-demo`!