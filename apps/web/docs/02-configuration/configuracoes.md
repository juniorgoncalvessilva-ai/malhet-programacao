# Configurações da Aplicação

## 📋 Visão Geral

Este documento detalha todas as configurações da aplicação, incluindo arquivos de configuração, variáveis de ambiente, dependências e scripts disponíveis.

## ⚙️ Arquivos de Configuração

### Next.js Configuration
```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Experimental features
  experimental: {
    serverActions: true,
  },
  
  // Image optimization
  images: {
    domains: ['clerk.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // Internationalization
  async redirects() {
    return [
      {
        source: '/',
        destination: '/pt-BR',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
```

### TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

### Tailwind CSS Configuration
```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        gray: {
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
        }
      },
      fontFamily: {
        satoshi: ["Satoshi", "sans-serif"],
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
      }
    },
  },
  plugins: [],
};

export default config;
```

### PostCSS Configuration
```javascript
// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

## 📦 Package.json

### Informações do Projeto
```json
{
  "name": "ai-coders-starter-kit",
  "version": "1.2.1",
  "private": true,
  "description": "A modern Next.js admin dashboard with authentication and i18n",
  "keywords": ["nextjs", "dashboard", "admin", "typescript", "tailwind"],
  "author": "AI Coders",
  "license": "MIT"
}
```

### Scripts Disponíveis
```json
{
  "scripts": {
    "dev": "next dev",           // Servidor de desenvolvimento
    "build": "next build",       // Build para produção
    "start": "next start",       // Servidor de produção
    "lint": "next lint",         // Linting com ESLint
    "type-check": "tsc --noEmit" // Verificação de tipos
  }
}
```

### Dependências Principais
```json
{
  "dependencies": {
    "@clerk/nextjs": "^6.21.0",        // Autenticação
    "next": "15.3.3",                  // Framework React
    "next-intl": "^4.1.0",             // Internacionalização
    "next-themes": "^0.4.4",           // Tema dark/light
    "react": "19.0.0",                 // React
    "react-dom": "19.0.0",             // React DOM
    "tailwindcss": "^3.4.16",          // CSS Framework
    "typescript": "^5",                // TypeScript
    "apexcharts": "^4.5.0",            // Gráficos
    "react-apexcharts": "^1.7.0",      // React wrapper para ApexCharts
    "jsvectormap": "^1.6.0",           // Mapas vetoriais
    "flatpickr": "^4.6.13",            // Date picker
    "dayjs": "^1.11.13",               // Manipulação de datas
    "nextjs-toploader": "^3.7.15",     // Loading bar
    "clsx": "^2.1.1",                  // Conditional classes
    "tailwind-merge": "^2.6.0",        // Merge Tailwind classes
    "class-variance-authority": "^0.7.1" // Variant classes
  }
}
```

### Dependências de Desenvolvimento
```json
{
  "devDependencies": {
    "@types/node": "^22",               // Types para Node.js
    "@types/react": "19.0.0",          // Types para React
    "@types/react-dom": "19.0.3",      // Types para React DOM
    "eslint": "^9",                     // Linter
    "eslint-config-next": "15.3.3",    // Configuração ESLint para Next.js
    "prettier": "^3.4.2",              // Formatador de código
    "prettier-plugin-tailwindcss": "^0.6.11", // Plugin Prettier para Tailwind
    "autoprefixer": "^10.4.20",        // Autoprefixer para CSS
    "postcss": "^8"                    // PostCSS
  }
}
```

## 🔐 Variáveis de Ambiente

### Arquivo .env.local
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/app
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/app

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (se aplicável)
DATABASE_URL=your-database-url

# External APIs (se aplicável)
API_BASE_URL=https://api.example.com
```

### Arquivo .env.local.example
```bash
# Clerk Authentication (obrigatório)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_secret_here

# Clerk URLs (opcional - padrões fornecidos)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/app
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/app

# Desenvolvimento
NODE_ENV=development
```

## 🎨 Configuração de Tema

### CSS Variables
```css
/* src/css/style.css */
:root {
  /* Colors */
  --primary: 59 130 246;
  --primary-foreground: 255 255 255;
  --secondary: 241 245 249;
  --secondary-foreground: 15 23 42;
  --background: 255 255 255;
  --foreground: 15 23 42;
  --muted: 248 250 252;
  --muted-foreground: 100 116 139;
  --border: 226 232 240;
  --input: 226 232 240;
  --ring: 59 130 246;
  
  /* Radius */
  --radius: 0.5rem;
}

.dark {
  --primary: 59 130 246;
  --primary-foreground: 255 255 255;
  --secondary: 30 41 59;
  --secondary-foreground: 248 250 252;
  --background: 15 23 42;
  --foreground: 248 250 252;
  --muted: 30 41 59;
  --muted-foreground: 148 163 184;
  --border: 51 65 85;
  --input: 51 65 85;
  --ring: 59 130 246;
}
```

### Theme Provider Configuration
```typescript
// app/providers.tsx
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
```

## 📱 Configuração de PWA (Futuro)

### Manifest.json (Preparado para PWA)
```json
{
  "name": "AI Coders - Starter Kit",
  "short_name": "AI Coders",
  "description": "Modern admin dashboard",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#3b82f6",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

## 🔧 Configuração de Desenvolvimento

### VSCode Settings
```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

### Git Configuration
```gitignore
# .gitignore
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Next.js
.next/
out/
build/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

## 🚀 Scripts Personalizados

### Build Scripts
```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build
npm run start

# Verificações
npm run lint
# npm run type-check  # Script não existe
```

### Scripts Úteis (package.json)
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    
    // Scripts do Supabase (reais)
    "db:start": "supabase start",
    "db:stop": "supabase stop", 
    "db:reset": "supabase db reset",
    "db:migrate": "supabase migration up",
    "db:studio": "supabase studio"
    
    // Scripts comentados não existem no projeto atual
    // "lint:fix": "next lint --fix",
    // "type-check": "tsc --noEmit",  
    // "format": "prettier --write .",
    // "format:check": "prettier --check .",
    // "clean": "rm -rf .next out dist",
    // "analyze": "ANALYZE=true npm run build"
  }
}
```

## 🏗️ Configuração de Deploy

### Vercel (Recomendado)
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": "@clerk-publishable-key",
    "CLERK_SECRET_KEY": "@clerk-secret-key"
  }
}
```

### Docker (Opcional)
```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

## 📊 Monitoramento e Analytics

### Performance Monitoring
```typescript
// next.config.mjs
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  
  // Web Vitals
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};
```

### Error Tracking (Preparado)
```typescript
// Sentry, LogRocket, ou similar
export function setupErrorTracking() {
  if (process.env.NODE_ENV === 'production') {
    // Configurar error tracking
  }
}
```

## 🔒 Configurações de Segurança

### Headers de Segurança
```typescript
// next.config.mjs
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  }
];
```

### CSP (Content Security Policy)
```typescript
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' clerk.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;
```