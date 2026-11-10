# 🤖 AI Agent Instructions - AI Coders Starter Kit

This document provides comprehensive instructions for AI agents working on this Next.js 15 admin dashboard project. Following these guidelines ensures consistency, quality, and adherence to project standards.

## 📋 Project Overview

**Project Name**: AI Coders Starter Kit  
**Framework**: Next.js 15 with App Router  
**Language**: TypeScript  
**Styling**: Tailwind CSS  
**Authentication**: Clerk  
**Database**: Supabase with PostgreSQL  
**Internationalization**: next-intl (pt-BR, en)  
**Theme**: Dark/Light mode support  

## 🏗️ Project Architecture

### Directory Structure
```
src/
├── app/[locale]/          # Internationalized App Router pages
├── components/            # Reusable components
│   ├── ui/               # Base UI components (Alert, Badge, Button, etc.)
│   ├── Layouts/          # Layout components (Header, Sidebar)
│   ├── Charts/           # Chart components
│   ├── Tables/           # Table components
│   └── FormElements/     # Form components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and configurations
├── types/                # TypeScript type definitions
├── services/             # API services and external integrations
├── utils/                # Utility functions
└── config/               # Configuration files
```

### Key Technologies
- **Next.js 15**: App Router, Server Components, Server Actions
- **TypeScript**: Strict type checking
- **Tailwind CSS**: Utility-first CSS framework
- **Clerk**: Authentication and user management
- **Supabase**: PostgreSQL database, Realtime, Storage, Row Level Security
- **next-intl**: Internationalization
- **next-themes**: Dark/light mode
- **CVA**: Class Variance Authority for component variants
- **Lucide React**: Icon library

## 🎯 Core Principles

### 1. Component Architecture
- **PascalCase naming**: All components use PascalCase (`Button.tsx`, `AlertDialog.tsx`)
- **Single responsibility**: Each component has one clear purpose
- **Reusability**: Components are designed to be reusable across the application
- **TypeScript**: Full type safety with proper interface definitions
- **CVA patterns**: Use Class Variance Authority for component variants

### 2. Code Organization
- **Colocation**: Related files are grouped together
- **Separation of concerns**: Logic, styles, and types are properly separated
- **Consistent imports**: Absolute imports using `@/` prefix
- **Export patterns**: Named exports for components, default for pages

### 3. Styling Standards
- **Tailwind-first**: Use Tailwind CSS classes for all styling
- **Dark mode**: All components support dark/light themes
- **Responsive design**: Mobile-first approach
- **CSS variables**: Use for theme colors and consistent values
- **Class organization**: Group related classes together

## 📝 Development Guidelines

### Component Creation Rules

#### 1. UI Components (`src/components/ui/`)
Follow this exact pattern for all UI components:

```typescript
// src/components/ui/ComponentName.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import * as React from "react";

const componentVariants = cva(
  "base-classes-here",
  {
    variants: {
      variant: {
        default: "default-classes",
        primary: "primary-classes",
        // Add more variants as needed
      },
      size: {
        sm: "small-classes",
        md: "medium-classes",
        lg: "large-classes",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ComponentNameProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {
  // Add component-specific props here
}

function ComponentName({
  className,
  variant,
  size,
  ...props
}: ComponentNameProps) {
  return (
    <div
      className={cn(componentVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { ComponentName, componentVariants };
```

#### 2. Page Components (`src/app/[locale]/`)
- **Server Components**: Use by default for pages
- **Metadata**: Always add proper metadata
- **Translations**: Use `getTranslations` from next-intl
- **Type safety**: Proper typing for params and searchParams

```typescript
// src/app/[locale]/example/page.tsx
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

interface PageProps {
  params: {
    locale: string;
  };
  searchParams?: {
    [key: string]: string | string[] | undefined;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = await getTranslations('metadata');
  
  return {
    title: t('example.title'),
    description: t('example.description'),
  };
}

export default async function ExamplePage({ params, searchParams }: PageProps) {
  const t = await getTranslations('example');
  
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      {/* Page content */}
    </div>
  );
}
```

### Naming Conventions

#### Files and Directories
- **Components**: PascalCase (`Button.tsx`, `AlertDialog.tsx`)
- **Pages**: kebab-case (`sign-in/page.tsx`, `form-elements/page.tsx`)
- **Hooks**: camelCase with `use` prefix (`useLocalStorage.ts`)
- **Utilities**: camelCase (`formatDate.ts`, `apiClient.ts`)
- **Types**: PascalCase (`UserData.ts`, `ApiResponse.ts`)

#### Code Elements
- **Components**: PascalCase (`<Button>`, `<AlertDialog>`)
- **Props**: camelCase (`variant`, `isLoading`, `onSubmit`)
- **Functions**: camelCase (`handleClick`, `formatCurrency`)
- **Constants**: UPPER_SNAKE_CASE (`API_ENDPOINTS`, `DEFAULT_THEME`)
- **Types/Interfaces**: PascalCase (`User`, `ApiResponse`, `ComponentProps`)

### TypeScript Requirements

#### 1. Strict Type Safety
- Always define proper interfaces for component props
- Use union types for specific values (variants, sizes, etc.)
- Avoid `any` type - use `unknown` or specific types
- Implement proper error handling with typed errors

#### 2. Component Props Pattern
```typescript
// ✅ Good - Proper interface extending HTML attributes
interface ButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

// ❌ Bad - Loose typing
interface ButtonProps {
  [key: string]: any;
}
```

## 🌍 Internationalization Rules

### 1. Translation Keys
- **Organized by feature**: Group related translations
- **Nested structure**: Use dot notation for organization
- **Consistent naming**: Use descriptive, hierarchical keys

```json
{
  "dashboard": {
    "overview": {
      "title": "Visão Geral",
      "description": "Acompanhe suas métricas principais"
    },
    "stats": {
      "totalUsers": "Total de Usuários",
      "revenue": "Receita"
    }
  }
}
```

### 2. Usage Patterns
```typescript
// ✅ Good - Organized namespace
const t = useTranslations('dashboard.overview');
<h1>{t('title')}</h1>

// ✅ Good - Server component
const t = await getTranslations('dashboard.overview');

// ❌ Bad - Hardcoded text
<h1>Dashboard Overview</h1>
```

### 3. Translation Requirements
- **No hardcoded text**: All user-facing text must be translatable
- **Both languages**: Add keys to both `pt-BR.json` and `en.json`
- **Contextual keys**: Use descriptive keys that indicate context

## 🎨 Styling Guidelines

### 1. Tailwind CSS Standards
- **Utility-first**: Use Tailwind classes for all styling
- **Responsive design**: Apply responsive modifiers (`sm:`, `md:`, `lg:`)
- **Dark mode**: Use `dark:` modifier for dark theme styles
- **Class organization**: Group related classes logically

```typescript
// ✅ Good - Organized and readable
<div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">

// ✅ Good - Using cn() utility for conditional classes
<button 
  className={cn(
    "px-4 py-2 rounded-md font-medium transition-colors",
    variant === 'primary' && "bg-blue-600 text-white hover:bg-blue-700",
    disabled && "opacity-50 cursor-not-allowed"
  )}
>
```

### 2. Theme Integration
- **CSS Variables**: Use for consistent theming
- **Dark mode support**: All components must work in both themes
- **Color system**: Use semantic color names from the design system

```css
/* ✅ Good - Using CSS variables */
.component {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  border-color: hsl(var(--border));
}
```

## 🔐 Security Requirements

### 1. Authentication & Authorization
- **AuthGuard**: Use for protected routes
- **Middleware**: Automatic authentication checks  
- **Role-based access**: Implement proper permission checks
- **Session management**: Proper session handling with Clerk

```typescript
// ✅ Good - Protected page with role check
export default function AdminPage() {
  return (
    <AuthGuard requiredRole="admin">
      <AdminContent />
    </AuthGuard>
  );
}

// ✅ Good - Server action with auth
'use server';
export async function sensitiveAction(data: FormData) {
  const { userId, user } = auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  if (user?.role !== 'admin') {
    throw new Error('Insufficient permissions');
  }
  
  // Proceed with action
}
```

### 2. Input Validation & Sanitization
- **Server-side validation**: Always validate on server
- **Client-side validation**: For UX, not security
- **Input sanitization**: Clean all user inputs
- **SQL injection prevention**: Use parameterized queries
- **XSS prevention**: Sanitize HTML content

```typescript
// ✅ Good - Comprehensive validation
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email('Invalid email').max(255),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z\s]+$/, 'Only letters allowed'),
  age: z.number().min(18).max(120)
});

export async function createUser(formData: FormData) {
  // Validate input
  const result = userSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    age: Number(formData.get('age'))
  });
  
  if (!result.success) {
    throw new Error('Invalid input data');
  }
  
  // Sanitize HTML content if needed
  const sanitizedName = DOMPurify.sanitize(result.data.name);
  
  // Process with validated data
}
```

### 3. Data Protection
- **No sensitive logs**: Never log passwords, tokens, or PII
- **Environment variables**: Store secrets in env vars
- **Database encryption**: Encrypt sensitive data at rest
- **HTTPS only**: Ensure all communications are encrypted
- **Secure headers**: Implement security headers

```typescript
// ✅ Good - Secure data handling
export async function handleUserData(userData: UserData) {
  // Remove sensitive fields before logging
  const { password, ssn, creditCard, ...safeData } = userData;
  console.log('Processing user:', safeData);
  
  // Hash passwords before storage
  const hashedPassword = await bcrypt.hash(password, 12);
  
  // Encrypt sensitive data
  const encryptedSSN = encrypt(ssn);
  
  return {
    ...safeData,
    password: hashedPassword,
    ssn: encryptedSSN
  };
}

// ❌ Bad - Exposing sensitive data
console.log('User data:', userData); // Contains password, SSN, etc.
```

### 4. Error Handling Security
- **Generic error messages**: Don't expose internal details
- **No stack traces**: Don't send stack traces to client
- **Proper logging**: Log errors securely server-side
- **Rate limiting**: Implement rate limiting for APIs

```typescript
// ✅ Good - Secure error handling
export async function loginUser(credentials: LoginData) {
  try {
    const user = await authenticateUser(credentials);
    return { success: true, user };
  } catch (error) {
    // Log detailed error server-side
    console.error('Login error:', {
      error: error.message,
      userId: credentials.email,
      timestamp: new Date().toISOString(),
      ip: getClientIP()
    });
    
    // Return generic error to client
    return { 
      success: false, 
      error: 'Invalid credentials' // Generic message
    };
  }
}

// ❌ Bad - Exposing internal details
catch (error) {
  return { error: error.message }; // Might expose DB structure, etc.
}
```

### 5. File Upload Security
- **File type validation**: Verify file types and extensions
- **File size limits**: Implement reasonable size limits
- **Malware scanning**: Scan uploaded files
- **Secure storage**: Store files securely, not in web root

```typescript
// ✅ Good - Secure file upload
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadFile(file: File) {
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }
  
  // Generate secure filename
  const secureFilename = generateSecureFilename(file.name);
  
  // Store in secure location (not web accessible)
  const storagePath = path.join(SECURE_UPLOADS_DIR, secureFilename);
  
  // Scan for malware (implement based on your setup)
  await scanForMalware(file);
  
  return { filename: secureFilename, path: storagePath };
}
```

### 6. API Security
- **Rate limiting**: Implement rate limiting
- **CORS configuration**: Proper CORS setup
- **API versioning**: Version your APIs
- **Request validation**: Validate all API requests

```typescript
// ✅ Good - Secure API endpoint
export async function POST(request: Request) {
  try {
    // Check rate limit
    const isRateLimited = await checkRateLimit(request);
    if (isRateLimited) {
      return new Response('Too Many Requests', { status: 429 });
    }
    
    // Validate authentication
    const { userId } = auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Validate request body
    const body = await request.json();
    const validatedData = apiSchema.parse(body);
    
    // Process request
    const result = await processRequest(validatedData);
    
    return Response.json(result);
  } catch (error) {
    // Log error securely
    logSecurely('API Error', error, request);
    
    // Return generic error
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

### 7. Frontend Security
- **Content Security Policy**: Implement CSP headers
- **XSS prevention**: Sanitize dynamic content
- **No sensitive data in localStorage**: Use secure storage
- **Secure communication**: HTTPS only

```typescript
// ✅ Good - Secure frontend practices
// Use secure storage for sensitive data
const secureStorage = {
  setItem: (key: string, value: string) => {
    // Encrypt before storing
    const encrypted = encrypt(value);
    sessionStorage.setItem(key, encrypted);
  },
  
  getItem: (key: string) => {
    const encrypted = sessionStorage.getItem(key);
    return encrypted ? decrypt(encrypted) : null;
  }
};

// Sanitize user content before rendering
const SafeUserContent = ({ content }: { content: string }) => {
  const sanitizedContent = DOMPurify.sanitize(content);
  return <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />;
};
```

### 🚨 Security Checklist
Before submitting code, verify:

#### ✅ Authentication & Authorization
- [ ] Protected routes use AuthGuard
- [ ] Server actions check authentication
- [ ] Role-based access is implemented
- [ ] Session management is secure

#### ✅ Input Validation
- [ ] All inputs are validated server-side
- [ ] Client-side validation is for UX only
- [ ] User inputs are sanitized
- [ ] File uploads are validated and secure

#### ✅ Data Protection
- [ ] No sensitive data in logs
- [ ] Passwords are properly hashed
- [ ] Sensitive data is encrypted
- [ ] Environment variables are used for secrets

#### ✅ Error Handling
- [ ] Generic error messages to users
- [ ] Detailed errors logged server-side only
- [ ] No stack traces exposed to client
- [ ] Rate limiting implemented

#### ✅ API Security
- [ ] Request validation implemented
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Authentication required for protected endpoints

#### ✅ Frontend Security
- [ ] No sensitive data in localStorage
- [ ] User content is sanitized
- [ ] CSP headers configured
- [ ] HTTPS enforced

## 🗄️ Supabase Database

### 1. Database Schema
The project uses Supabase with PostgreSQL and includes pre-configured tables:

- **profiles**: User profile information (linked to Clerk)
- **posts**: User-generated content with publishing system
- **comments**: Comments on posts with cascading deletes

### 2. Migration System
Database changes are managed through Supabase migrations located in `supabase/migrations/`:

```
supabase/migrations/
├── 20240617000001_initial_setup.sql       # Base setup and functions
├── 20240617000002_create_profiles_table.sql
├── 20240617000003_create_posts_table.sql
├── 20240617000004_create_comments_table.sql
├── 20240617000005_realtime_setup.sql      # Enable realtime features
└── 20240617000006_fix_clerk_rls_policies.sql # Clerk integration
```

### 3. Row Level Security (RLS)
All tables use RLS policies that integrate with Clerk authentication:

```sql
-- Helper function for Clerk integration
CREATE OR REPLACE FUNCTION get_clerk_user_id() 
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claim.sub', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example policy using the helper function
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (user_id = get_clerk_user_id());
```

### 4. Realtime Features
Tables are enabled for real-time subscriptions:

```typescript
// Subscribe to changes on posts table  
const channel = supabase
  .channel('posts-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'posts'
  }, (payload) => {
    console.log('Real-time change:', payload);
  })
  .subscribe();
```

### 5. Local Development
Use Supabase CLI for local development:

```bash
# Start local Supabase stack
supabase start

# Apply migrations
supabase db reset

# Deploy to production
supabase db push
```

### 6. Client Configuration
Supabase client is configured in `src/lib/supabase/`:

```typescript
// Browser client with Clerk integration
export const createBrowserClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: async (url, options = {}) => {
          const clerkToken = await window.Clerk?.session?.getToken({
            template: 'supabase'
          });
          // ... token injection logic
        }
      }
    }
  );
};
```

## 📊 State Management

### 1. Patterns
- **Server state**: Use Server Components and Server Actions
- **Database state**: Use Supabase client with Clerk integration
- **Client state**: Use React hooks (useState, useReducer)
- **Shared state**: Use React Context for component trees
- **Complex logic**: Extract to custom hooks

### 2. Server Actions Pattern
```typescript
// actions/user-actions.ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

export async function updateUserProfile(formData: FormData) {
  const { userId } = auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  // Update logic here
  
  revalidatePath('/profile');
  return { success: true };
}
```

## 🧪 Testing Requirements

### 1. Component Testing
- **Unit tests**: For utility functions and hooks
- **Component tests**: For UI components with React Testing Library
- **Integration tests**: For complex workflows

### 2. Testing Patterns
```typescript
// ✅ Good - Comprehensive component test
describe('Button Component', () => {
  it('renders with correct variant classes', () => {
    render(<Button variant="primary">Test</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary');
  });
  
  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Test</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

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

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # TypeScript compilation check

# Testing
npm run test            # Run tests
npm run test:watch      # Run tests in watch mode
```

## 📖 Documentation References

When working on this project, refer to:

- **[Project Documentation](./docs/)**: Complete project documentation
- **[Component Guidelines](./docs/04-components/)**: Component creation and styling
- **[Development Guide](./docs/03-development/guia-desenvolvimento.md)**: Detailed development practices
- **[Internationalization](./docs/05-features/internacionalizacao.md)**: i18n implementation details
- **[Authentication](./docs/05-features/autenticacao.md)**: Complete auth implementation with Clerk
- **[Clerk Setup](./docs/02-configuration/autenticacao.md)**: Basic Clerk configuration
- **[Clerk-Supabase Integration](./docs/02-configuration/clerk-supabase-integracao.md)**: Integration details
- **[Clerk Webhooks](./docs/02-configuration/webhooks-clerk.md)**: Webhook configuration

## 🎯 Success Metrics

Your contributions should:
1. **Maintain consistency** with existing code patterns
2. **Follow TypeScript best practices** with full type safety
3. **Support internationalization** for both pt-BR and en locales
4. **Work seamlessly** in both light and dark themes
5. **Be responsive** and accessible on all devices
6. **Include proper error handling** and loading states
7. **Follow the established component architecture** with CVA patterns

---

**Remember**: This is a production-ready admin dashboard starter kit. All code should meet professional standards for maintainability, performance, and user experience.