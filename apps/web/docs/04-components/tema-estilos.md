# Tema e Estilos

## 📋 Visão Geral

A aplicação utiliza um sistema de design moderno e flexível baseado em **Tailwind CSS** com suporte completo a temas dark/light através do **next-themes**. O sistema de cores é baseado em CSS variables, permitindo customizações dinâmicas e consistência visual.

## 🎨 Sistema de Cores

### Paleta Principal
```css
/* src/css/style.css */
:root {
  /* Primary Colors */
  --primary: 59 130 246;           /* Blue 500 */
  --primary-foreground: 255 255 255;
  
  /* Secondary Colors */
  --secondary: 241 245 249;        /* Slate 100 */
  --secondary-foreground: 15 23 42;
  
  /* Background Colors */
  --background: 255 255 255;
  --foreground: 15 23 42;
  
  /* Neutral Colors */
  --muted: 248 250 252;           /* Slate 50 */
  --muted-foreground: 100 116 139; /* Slate 500 */
  
  /* Border Colors */
  --border: 226 232 240;          /* Slate 200 */
  --input: 226 232 240;
  --ring: 59 130 246;             /* Focus ring */
  
  /* Status Colors */
  --destructive: 239 68 68;       /* Red 500 */
  --destructive-foreground: 255 255 255;
  --success: 34 197 94;           /* Green 500 */
  --warning: 245 158 11;          /* Amber 500 */
}
```

### Dark Theme
```css
.dark {
  --primary: 59 130 246;
  --primary-foreground: 255 255 255;
  --secondary: 30 41 59;          /* Slate 800 */
  --secondary-foreground: 248 250 252;
  --background: 15 23 42;         /* Slate 900 */
  --foreground: 248 250 252;      /* Slate 50 */
  --muted: 30 41 59;              /* Slate 800 */
  --muted-foreground: 148 163 184; /* Slate 400 */
  --border: 51 65 85;             /* Slate 700 */
  --input: 51 65 85;
  --ring: 59 130 246;
  --destructive: 220 38 38;       /* Red 600 */
  --destructive-foreground: 255 255 255;
}
```

### Uso das Cores no Tailwind
```typescript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      primary: {
        DEFAULT: "hsl(var(--primary))",
        foreground: "hsl(var(--primary-foreground))",
      },
      secondary: {
        DEFAULT: "hsl(var(--secondary))",
        foreground: "hsl(var(--secondary-foreground))",
      },
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      muted: {
        DEFAULT: "hsl(var(--muted))",
        foreground: "hsl(var(--muted-foreground))",
      }
    }
  }
}
```

## 🌓 Sistema de Tema Dark/Light

### Configuração do Theme Provider
```typescript
// app/providers.tsx
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider
      attribute="class"           // Usa class="dark" no html
      defaultTheme="system"       // Segue preferência do sistema
      enableSystem={true}         // Detecta preferência do OS
      disableTransitionOnChange   // Evita animações durante mudança
    >
      {children}
    </ThemeProvider>
  );
}
```

### Theme Toggle Component
```typescript
// components/Layouts/header/theme-toggle/index.tsx
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Evita hydration mismatch
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-lg bg-secondary hover:bg-muted transition-colors"
    >
      {theme === 'dark' ? '🌞' : '🌙'}
    </button>
  );
}
```

### Classes Condicionais por Tema
```css
/* Exemplo de uso */
.component {
  @apply bg-background text-foreground;
  @apply border border-border;
  @apply shadow-sm;
}

/* Ou com classes específicas */
.card {
  @apply bg-white dark:bg-slate-800;
  @apply text-slate-900 dark:text-slate-100;
  @apply border-slate-200 dark:border-slate-700;
}
```

## 🔤 Tipografia

### Fonte Principal - Satoshi
```css
/* src/css/satoshi.css */
@font-face {
  font-family: "Satoshi";
  src: url("../fonts/Satoshi-Regular.woff2") format("woff2"),
       url("../fonts/Satoshi-Regular.woff") format("woff"),
       url("../fonts/Satoshi-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Satoshi";
  src: url("../fonts/Satoshi-Medium.woff2") format("woff2"),
       url("../fonts/Satoshi-Medium.woff") format("woff"),
       url("../fonts/Satoshi-Medium.ttf") format("truetype");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Satoshi";
  src: url("../fonts/Satoshi-Bold.woff2") format("woff2"),
       url("../fonts/Satoshi-Bold.woff") format("woff"),
       url("../fonts/Satoshi-Bold.ttf") format("truetype");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

### Configuração no Tailwind
```typescript
// tailwind.config.ts
theme: {
  extend: {
    fontFamily: {
      satoshi: ["Satoshi", "sans-serif"],
      sans: ["Satoshi", "system-ui", "sans-serif"],
    },
  }
}
```

### Hierarquia Tipográfica
```css
/* Headings */
.text-heading-1 { @apply text-4xl font-bold leading-tight; }
.text-heading-2 { @apply text-3xl font-bold leading-tight; }
.text-heading-3 { @apply text-2xl font-semibold leading-tight; }
.text-heading-4 { @apply text-xl font-semibold leading-tight; }
.text-heading-5 { @apply text-lg font-medium leading-tight; }

/* Body Text */
.text-body-lg { @apply text-lg leading-relaxed; }
.text-body { @apply text-base leading-relaxed; }
.text-body-sm { @apply text-sm leading-relaxed; }

/* Labels */
.text-label { @apply text-sm font-medium; }
.text-label-sm { @apply text-xs font-medium uppercase tracking-wide; }
```

## 📱 Sistema Responsivo

### Breakpoints
```typescript
// tailwind.config.ts
theme: {
  screens: {
    'xs': '475px',    // Mobile extra small
    'sm': '640px',    // Mobile
    'md': '768px',    // Tablet
    'lg': '1024px',   // Desktop small
    'xl': '1280px',   // Desktop
    '2xl': '1536px',  // Desktop large
  }
}
```

### Mobile-First Approach
```css
/* Padrão mobile */
.container {
  @apply w-full px-4;
}

/* Tablet e acima */
@screen md {
  .container {
    @apply px-6;
  }
}

/* Desktop e acima */
@screen lg {
  .container {
    @apply max-w-7xl mx-auto px-8;
  }
}
```

## 🎯 Componentes Base

### Button Variants
```typescript
// components/ui-elements/button.tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

### Card Component
```css
.card {
  @apply bg-background text-foreground;
  @apply border border-border rounded-lg;
  @apply shadow-sm;
}

.card-header {
  @apply p-6 pb-0;
}

.card-content {
  @apply p-6;
}

.card-footer {
  @apply p-6 pt-0;
}
```

### Input Component
```css
.input {
  @apply flex h-10 w-full rounded-md border border-input;
  @apply bg-background px-3 py-2 text-sm;
  @apply ring-offset-background;
  @apply file:border-0 file:bg-transparent file:text-sm file:font-medium;
  @apply placeholder:text-muted-foreground;
  @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2;
  @apply disabled:cursor-not-allowed disabled:opacity-50;
}
```

## 🎨 Animações e Transições

### CSS Animations
```css
/* src/css/style.css */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

### Tailwind Animations
```typescript
// tailwind.config.ts
theme: {
  extend: {
    animation: {
      "fade-in": "fadeIn 0.5s ease-in-out",
      "slide-in-right": "slideInRight 0.3s ease-out",
      "pulse": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      "spin-slow": "spin 3s linear infinite",
    },
    keyframes: {
      fadeIn: {
        "0%": { opacity: "0" },
        "100%": { opacity: "1" },
      },
      slideInRight: {
        "0%": { transform: "translateX(100%)" },
        "100%": { transform: "translateX(0)" },
      },
    }
  }
}
```

### Transition Classes
```css
.transition-base {
  @apply transition-all duration-200 ease-in-out;
}

.transition-colors {
  @apply transition-colors duration-200 ease-in-out;
}

.transition-transform {
  @apply transition-transform duration-200 ease-in-out;
}
```

## 🌟 Estados Interativos

### Hover States
```css
.hover-lift {
  @apply transition-transform hover:scale-105;
}

.hover-shadow {
  @apply transition-shadow hover:shadow-lg;
}

.hover-bg {
  @apply transition-colors hover:bg-muted;
}
```

### Focus States
```css
.focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2;
}

.focus-visible-ring {
  @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring;
}
```

### Active States
```css
.active-scale {
  @apply active:scale-95 transition-transform;
}

.active-bg {
  @apply active:bg-accent;
}
```

## 🔧 Utilitários Customizados

### Layout Utilities
```css
.container-padding {
  @apply px-4 sm:px-6 lg:px-8;
}

.section-spacing {
  @apply py-16 sm:py-20 lg:py-24;
}

.card-spacing {
  @apply p-4 sm:p-6 lg:p-8;
}
```

### Text Utilities
```css
.text-gradient {
  @apply bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent;
}

.text-shadow {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

### Border Utilities
```css
.border-gradient {
  @apply border border-transparent bg-gradient-to-r from-primary to-secondary bg-clip-padding;
}

.border-dashed-primary {
  @apply border-2 border-dashed border-primary;
}
```

## 📊 Loading States

### Skeleton Components
```css
.skeleton {
  @apply animate-pulse bg-muted rounded;
}

.skeleton-text {
  @apply skeleton h-4 w-full;
}

.skeleton-avatar {
  @apply skeleton h-10 w-10 rounded-full;
}

.skeleton-button {
  @apply skeleton h-10 w-24 rounded-md;
}
```

### Loading Animations
```css
.loading-spinner {
  @apply animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full;
}

.loading-dots::after {
  content: '';
  @apply inline-block animate-ping h-1 w-1 bg-current rounded-full;
}
```

## 🎨 CSS Utilities Classes

### Spacing System
```css
/* Gap utilities */
.gap-grid { @apply gap-4 sm:gap-6 lg:gap-8; }
.gap-card { @apply gap-6; }
.gap-form { @apply gap-4; }

/* Padding utilities */
.p-page { @apply p-4 sm:p-6 lg:p-8; }
.p-card { @apply p-6; }
.p-section { @apply py-12 sm:py-16 lg:py-20; }
```

### Flexbox Utilities
```css
.flex-center { @apply flex items-center justify-center; }
.flex-between { @apply flex items-center justify-between; }
.flex-start { @apply flex items-center justify-start; }
.flex-end { @apply flex items-center justify-end; }
```

### Grid Utilities
```css
.grid-auto-fit { @apply grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))]; }
.grid-responsive { @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4; }
```

## 🔍 Debug Utilities

### Development Helpers
```css
/* Só em desenvolvimento */
@media (prefers-color-scheme: debug) {
  .debug-red { @apply border-2 border-red-500 bg-red-100; }
  .debug-blue { @apply border-2 border-blue-500 bg-blue-100; }
  .debug-green { @apply border-2 border-green-500 bg-green-100; }
}
```

### Responsive Debug
```css
.debug-breakpoint::before {
  @apply fixed top-0 left-0 z-50 bg-black text-white p-2 text-xs;
  content: 'xs';
}

@screen sm {
  .debug-breakpoint::before { content: 'sm'; }
}

@screen md {
  .debug-breakpoint::before { content: 'md'; }
}

@screen lg {
  .debug-breakpoint::before { content: 'lg'; }
}

@screen xl {
  .debug-breakpoint::before { content: 'xl'; }
}

@screen 2xl {
  .debug-breakpoint::before { content: '2xl'; }
}
```