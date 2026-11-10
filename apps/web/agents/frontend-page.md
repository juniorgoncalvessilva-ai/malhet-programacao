# 📄 Frontend Page Implementation Guide

## Context
You are creating a new page for the AI Coders Starter Kit project using:
- Next.js 15.3.3 App Router
- File-based routing with internationalization
- TypeScript
- Server and Client Components
- Clerk authentication (when needed)

## 🏗️ IMPORTANT: Nova Arquitetura Landing + App

### Estrutura de Páginas
A aplicação agora possui dois contextos distintos:

#### 🏠 Landing Page (Público)
- **Localização**: `/src/app/[locale]/page.tsx`
- **Componentes**: `/src/app/[locale]/_components/`
- **Propósito**: Marketing, apresentação do produto
- **Layout**: Navbar + Footer (sem sidebar)

#### 📱 Aplicação (Protegida) 
- **Localização**: `/src/app/[locale]/app/`
- **Layout**: `/src/app/[locale]/app/layout.tsx` (AuthGuard + Sidebar)
- **Propósito**: Funcionalidades do produto
- **Rotas**: Todas as páginas da aplicação vivem sob `/app/`

### Onde Criar Páginas

#### Para Landing/Marketing:
```
/src/app/[locale]/_components/
```

#### Para Aplicação (Dashboard):
```
/src/app/[locale]/app/sua-pagina/
```

## Project Structure Reference
- **Landing**: `/src/app/[locale]/` (público)
- **App Pages**: `/src/app/[locale]/app/` (protegido)
- **App Layout**: `/src/app/[locale]/app/layout.tsx`
- **Components**: `/src/components/`
- **Translations**: `/src/i18n/locales/`

## Implementation Requirements

### 1. File Structure

#### Para Páginas da Aplicação (Protegidas):
```
/src/app/[locale]/app/example/
├── page.tsx          # Main page component
├── layout.tsx        # Optional: Custom layout
├── loading.tsx       # Optional: Loading state
├── error.tsx         # Optional: Error boundary
└── _components/      # Optional: Page-specific components
```

#### Para Componentes da Landing:
```
/src/app/[locale]/_components/
├── hero-section.tsx
├── features-section.tsx
└── navbar.tsx
```

### 2. Basic Page Template

#### Para Páginas da Aplicação:
```typescript
// /src/app/[locale]/app/example/page.tsx
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";

export async function generateMetadata({
  params: { locale }
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "ExamplePage" });
  
  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

export default async function ExamplePage({
  params: { locale }
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: "ExamplePage" });
  
  return (
    <>
      <Breadcrumb pageName={t("title")} />
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-3xl font-bold dark:text-white">
          {t("title")}
        </h1>
        {/* Page content - Layout com sidebar é automático */}
      </div>
    </>
  );
}
```

**IMPORTANTE**: O layout com AuthGuard + Sidebar é aplicado automaticamente pelo `/src/app/[locale]/app/layout.tsx`

### 3. Protected Page Template
```typescript
// DESNECESSÁRIO! Páginas em /app/ já são protegidas automaticamente
// O AuthGuard está no layout em /src/app/[locale]/app/layout.tsx
// Apenas crie sua página normalmente em /src/app/[locale]/app/example/page.tsx
```

### 4. Client Components in Pages
```typescript
// When you need client-side features
import { ClientComponent } from "./_components/ClientComponent";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";

export default function Page() {
  return (
    <>
      <Breadcrumb pageName="Example" />
      <div>
        <ServerContent />
        <ClientComponent />
      </div>
    </>
  );
}
```

### 4.1. Using Zustand in Pages
```typescript
// For client components that need global state
"use client";

import { useAppStore, useUIActions } from '@/store';

export default function InteractivePage() {
  const { user, isLoading } = useAppStore((state) => ({
    user: state.user,
    isLoading: state.isLoading,
  }));
  
  const { showToast } = useUIActions();
  
  // Component implementation
}
```

### 5. Data Fetching Patterns
```typescript
// Server-side data fetching
async function getData() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/data`, {
    cache: 'no-store' // or { next: { revalidate: 60 } }
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch data');
  }
  
  return res.json();
}

export default async function Page() {
  const data = await getData();
  // Use data in component
}
```

### 6. Loading States
```typescript
// /src/app/[locale]/example/loading.tsx
export default function Loading() {
  return (
    <DefaultLayout>
      <div className="animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded dark:bg-gray-700" />
        {/* More skeleton UI */}
      </div>
    </DefaultLayout>
  );
}
```

### 7. Error Handling
```typescript
// /src/app/[locale]/example/error.tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <DefaultLayout>
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
        <button
          onClick={() => reset()}
          className="bg-primary text-white px-4 py-2 rounded"
        >
          Try again
        </button>
      </div>
    </DefaultLayout>
  );
}
```

### 8. Navigation Integration
Add to navigation configuration:
```typescript
// /src/hooks/useNavigation.ts
const navigationItems = [
  // ... existing items
  {
    title: t("example"),
    url: "/app/example", // IMPORTANTE: Prefixo /app/ para páginas protegidas
    icon: Icons.ExampleIcon,
    items: [],
  }
];
```

### 9. Translations
Create translation files:
```json
// /src/i18n/locales/pt/ExamplePage.json
{
  "meta": {
    "title": "Página de Exemplo",
    "description": "Descrição da página"
  },
  "title": "Título da Página",
  "content": "Conteúdo..."
}

// /src/i18n/locales/en/ExamplePage.json
{
  "meta": {
    "title": "Example Page",
    "description": "Page description"
  },
  "title": "Page Title",
  "content": "Content..."
}
```

## Layout Options

### Layouts Automáticos
- **Landing Page** (`/`): Sem layout wrapper, implementação própria
- **Auth Pages** (`/auth/*`): Layout simples sem sidebar
- **App Pages** (`/app/*`): AuthGuard + Sidebar + Header automático

### Layouts Customizados
- Crie `layout.tsx` na pasta da página para customização
- Exemplo: `/src/app/[locale]/app/profile/layout.tsx`

## Documentation References
- Pages and routing: `/docs/03-development/paginas-rotas.md`
- Internationalization: `/docs/05-features/internacionalizacao.md`
- Authentication: `/docs/05-features/autenticacao.md`

## Testing Checklist
- [ ] Page renders at correct route
- [ ] Metadata (title, description) is set
- [ ] Works in all supported locales (pt, en)
- [ ] Authentication works if protected
- [ ] Data fetching works correctly
- [ ] Loading and error states handled
- [ ] Added to navigation if needed
- [ ] Responsive design
- [ ] Dark mode support

## Example Pages to Reference

### Landing Page
- `/src/app/[locale]/page.tsx` - Landing page principal
- `/src/app/[locale]/_components/` - Componentes da landing

### App Pages (Protegidas)
- `/src/app/[locale]/app/dashboard/page.tsx` - Dashboard principal
- `/src/app/[locale]/app/api-demo/page.tsx` - API demo page
- `/src/app/[locale]/app/forms/form-elements/page.tsx` - Form page
- `/src/app/[locale]/app/profile/page.tsx` - Profile page

### Auth Pages
- `/src/app/[locale]/auth/sign-in/page.tsx` - Login page