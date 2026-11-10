# Project Structure Rules

## 📁 Directory Organization

### Root Level Structure
```
nextjs-admin-dashboard/
├── .rules/                 # AI agent rules and guidelines
├── docs/                   # Project documentation
├── messages/              # Internationalization files
├── public/                # Static assets
├── src/                   # Source code
├── AGENT.md               # AI agent instructions
├── README.md              # Project overview
├── package.json           # Dependencies and scripts
├── next.config.mjs        # Next.js configuration
├── tailwind.config.ts     # Tailwind CSS configuration
└── tsconfig.json          # TypeScript configuration
```

### Source Directory (`src/`)
```
src/
├── app/                   # Next.js 15 App Router
│   ├── [locale]/         # Internationalized routes
│   ├── favicon.ico       # Favicon
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Root page (redirects to locale)
│   └── providers.tsx     # Global providers
├── components/           # React components
├── hooks/               # Custom React hooks
├── i18n/                # Internationalization configuration
├── lib/                 # Utility libraries and configurations
├── services/            # API services and external integrations
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
├── config/              # Application configuration
├── css/                 # Global stylesheets
└── middleware.ts        # Next.js middleware
```

## 🎯 App Router Structure

### Locale-based Routing
```
app/[locale]/
├── (home)/              # Route group for homepage
│   ├── _components/     # Private components (not routable)
│   │   ├── chats-card.tsx
│   │   └── overview-cards/
│   ├── fetch.ts         # Data fetching utilities
│   └── page.tsx         # Homepage
├── auth/                # Authentication pages
│   ├── sign-in/
│   │   ├── page.tsx
│   │   └── sso-callback/
│   └── sign-up/
├── calendar/            # Calendar page
├── charts/              # Chart pages
├── forms/               # Form pages
├── pages/               # Miscellaneous pages
├── profile/             # User profile pages
├── tables/              # Table pages
├── ui-elements/         # UI showcase pages
└── layout.tsx           # Locale-specific layout
```

### Page Component Rules
- **File name**: Always `page.tsx` in route directories
- **Metadata**: Include `generateMetadata` function for SEO
- **Translations**: Use `getTranslations` for server components
- **Types**: Proper typing for `params` and `searchParams`

```typescript
// ✅ Good - Proper page structure
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
    title: t('page.title'),
    description: t('page.description'),
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const t = await getTranslations('page');
  
  return (
    <div>
      <h1>{t('title')}</h1>
      {/* Page content */}
    </div>
  );
}
```

### Route Groups
- **Parentheses notation**: `(group-name)` for organization without affecting URL
- **Private folders**: Underscore prefix `_components` for non-routable folders
- **Loading/Error states**: `loading.tsx` and `error.tsx` files

```
app/[locale]/
├── (home)/              # Groups homepage related files
├── (auth)/              # Groups authentication pages
├── _components/         # Private components (not routable)
├── _lib/               # Private utilities (not routable)
└── api/                # API routes (if needed)
```

## 🧩 Component Organization

### Component Directory Structure
```
src/components/
├── ui/                  # Base UI components
│   ├── Button.tsx      # Simple components
│   ├── alert/          # Complex components with subparts
│   │   ├── Alert.tsx
│   │   ├── AlertHeader.tsx
│   │   ├── AlertContent.tsx
│   │   ├── icons.tsx
│   │   └── index.tsx   # Barrel export
│   └── carousel/
├── Layouts/            # Layout components
│   ├── header/
│   │   ├── index.tsx
│   │   ├── icons.tsx
│   │   ├── notification/
│   │   ├── theme-toggle/
│   │   └── user-info/
│   └── sidebar/
├── Charts/             # Chart components
├── Tables/             # Table components
├── FormElements/       # Form components
│   ├── enhanced/       # Advanced form components
│   ├── Checkboxes/
│   ├── DatePicker/
│   └── InputGroup/
└── [FeatureName]/      # Feature-specific components
```

### Component File Rules
- **Single component per file**: One main component per file
- **Related files grouped**: Keep related components in subdirectories
- **Index files**: Use for barrel exports in complex components
- **Private components**: Prefix with underscore if not meant for external use

```typescript
// ✅ Good - Barrel export (index.tsx)
export { Alert } from './Alert';
export { AlertHeader } from './AlertHeader';
export { AlertContent } from './AlertContent';
export type { AlertProps } from './Alert';

// ✅ Good - Re-exports with types
export { Alert, type AlertProps } from './Alert';
```

## 🔧 Utility Organization

### Hooks Directory
```
src/hooks/
├── use-click-outside.ts    # DOM interaction hooks
├── use-mobile.ts          # Responsive hooks
├── use-local-storage.ts   # Storage hooks
├── use-api-client.ts      # API hooks
├── use-form-validation.ts # Form hooks
└── index.ts               # Barrel export for common hooks
```

### Services Directory
```
src/services/
├── api/                   # API related services
│   ├── client.ts         # API client configuration
│   ├── auth.ts           # Authentication API
│   ├── users.ts          # User API endpoints
│   └── types.ts          # API type definitions
├── charts.service.ts     # Chart data services
├── validation.service.ts # Validation services
└── index.ts              # Service exports
```

### Lib Directory
```
src/lib/
├── utils.ts              # Common utilities (cn function, etc.)
├── format-date.ts        # Date formatting utilities
├── format-number.ts      # Number formatting utilities
├── api-client.ts         # API client setup
├── constants.ts          # App-wide constants
└── validations.ts        # Validation schemas
```

### Types Directory
```
src/types/
├── global.d.ts           # Global type declarations
├── api.ts               # API response types
├── user.ts              # User-related types
├── component-props.ts   # Common component prop types
├── form.ts              # Form-related types
└── index.ts             # Type exports
```

## 📦 Configuration Files

### Configuration Directory
```
src/config/
├── app.ts               # Application configuration
├── constants.ts         # Application constants
├── demo-data.ts         # Demo data for development
├── navigation.ts        # Navigation configuration
└── index.ts             # Configuration exports
```

### Configuration Pattern
```typescript
// src/config/app.ts
export const appConfig = {
  name: "AI Coders - Starter Kit",
  description: "Professional admin dashboard starter kit",
  version: "1.2.1",
  author: {
    name: "AI Coders",
    url: "https://github.com/ai-coders"
  },
  social: {
    github: "https://github.com/ai-coders/nextjs-admin-dashboard",
    twitter: "@aicoders"
  },
  features: {
    auth: true,
    analytics: true,
    i18n: true,
    darkMode: true
  }
} as const;

// Export specific configurations
export const { name, version, features } = appConfig;
```

## 🌐 Internationalization Structure

### Messages Directory
```
messages/
├── en.json              # English translations
└── pt-BR.json           # Portuguese (Brazil) translations
```

### i18n Configuration
```
src/i18n/
├── navigation.ts        # Navigation configuration
├── request.ts           # Request configuration
└── routing.ts           # Routing configuration
```

### Translation File Structure
```json
{
  "common": {
    "loading": "Loading...",
    "error": "Error",
    "success": "Success"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "profile": "Profile",
    "settings": "Settings"
  },
  "dashboard": {
    "overview": {
      "title": "Dashboard Overview",
      "description": "Monitor your key metrics"
    }
  },
  "forms": {
    "validation": {
      "required": "This field is required",
      "email": "Please enter a valid email"
    }
  }
}
```

## 📄 Asset Organization

### Public Directory
```
public/
├── images/              # Image assets
│   ├── brand/          # Brand assets (logos, etc.)
│   ├── user/           # User avatars and profile images
│   ├── cards/          # Card images
│   ├── carousel/       # Carousel images
│   └── icons/          # Icon assets
├── favicon.ico         # Favicon
└── manifest.json       # PWA manifest (if applicable)
```

### CSS Directory
```
src/css/
├── globals.css         # Global styles and CSS variables
├── satoshi.css         # Custom font declarations
└── components.css      # Component-specific styles (minimal)
```

## 🚫 Anti-patterns to Avoid

### Directory Structure Anti-patterns
```
// ❌ Bad - Mixed naming conventions
src/components/
├── Button.tsx
├── alert-dialog.tsx    # Should be AlertDialog.tsx
├── user_profile.tsx    # Should be UserProfile.tsx

// ❌ Bad - Inconsistent organization
src/
├── components/Button.tsx
├── hooks/useButton.ts  # Should be co-located or in hooks/
├── types/ButtonTypes.ts # Should be in component or types/

// ❌ Bad - Too deep nesting
src/components/ui/forms/inputs/text/variations/large/
├── LargeTextInput.tsx  # Too deep - should be flattened
```

### File Organization Anti-patterns
```
// ❌ Bad - Everything in one directory
src/components/
├── Button.tsx
├── Alert.tsx
├── Header.tsx
├── Sidebar.tsx
├── Chart.tsx
├── Table.tsx
├── Form.tsx
└── ... (50+ components)

// ✅ Good - Properly organized
src/components/
├── ui/
│   ├── Button.tsx
│   └── Alert.tsx
├── Layouts/
│   ├── Header.tsx
│   └── Sidebar.tsx
├── Charts/
│   └── Chart.tsx
└── Tables/
    └── Table.tsx
```

## 📋 File Organization Checklist

### ✅ Directory Structure
- [ ] Components are properly categorized (ui, Layouts, Charts, etc.)
- [ ] Related files are co-located
- [ ] No circular dependencies
- [ ] Consistent naming conventions

### ✅ Import Organization
- [ ] Absolute imports using `@/` prefix
- [ ] Grouped imports (React, libraries, internal)
- [ ] No deep relative imports (`../../../`)
- [ ] Barrel exports for complex modules

### ✅ File Naming
- [ ] PascalCase for components
- [ ] camelCase for utilities and hooks
- [ ] kebab-case for page directories
- [ ] Descriptive, not abbreviated names

### ✅ Export Patterns
- [ ] Named exports for components
- [ ] Default exports only for pages
- [ ] Type exports where needed
- [ ] Consistent export organization

### ✅ Security & Configuration
- [ ] Sensitive files are properly protected (.env, etc.)
- [ ] No secrets committed to version control
- [ ] Configuration files are organized and secure
- [ ] API routes follow security patterns
- [ ] File permissions are appropriate
- [ ] No sensitive data in public directory
- [ ] Environment variables are properly structured
- [ ] Build artifacts are gitignored

## 🔍 Maintenance Guidelines

### Regular Cleanup
- **Remove unused files**: Regularly audit for unused components
- **Consolidate similar**: Merge similar utilities or components
- **Update imports**: Keep import paths up to date
- **Documentation**: Update structure documentation

### Scalability Considerations
- **Feature-based organization**: Consider feature folders for large features
- **Shared components**: Keep truly shared components in common directories
- **Lazy loading**: Structure for code splitting where beneficial
- **Bundle analysis**: Monitor and optimize bundle size

### Migration Strategies
- **Gradual refactoring**: Migrate file structure gradually
- **Deprecation notices**: Mark old patterns as deprecated
- **Update tooling**: Keep build tools and linters updated
- **Team communication**: Communicate structure changes clearly

## 📖 Documentation Requirements

### File Documentation
- **README files**: Add README.md for complex directories
- **Component documentation**: Document complex components
- **API documentation**: Document service interfaces
- **Configuration docs**: Document configuration options

### Structure Documentation
- **Architecture diagrams**: Keep structure diagrams updated
- **Decision records**: Document structural decisions
- **Migration guides**: Document major structural changes
- **Onboarding docs**: Include structure in onboarding materials