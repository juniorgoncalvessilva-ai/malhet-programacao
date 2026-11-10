# Internationalization Rules

## 🌍 Overview

This application uses **next-intl** for internationalization with support for:
- **Portuguese (Brazil)**: `pt-BR` (default)
- **English**: `en`

All user-facing text must be translatable and follow the established i18n patterns.

## 📁 File Structure

### Translation Files
```
messages/
├── en.json              # English translations
└── pt-BR.json           # Portuguese (Brazil) translations
```

### i18n Configuration
```
src/i18n/
├── navigation.ts        # Internationalized navigation
├── request.ts           # Request configuration
└── routing.ts           # Routing configuration
```

### Middleware
```
src/middleware.ts        # Locale detection and routing
```

## 🗂️ Translation Key Organization

### Hierarchical Structure
Organize translation keys by feature and context:

```json
{
  "common": {
    "actions": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit",
      "create": "Create",
      "update": "Update"
    },
    "states": {
      "loading": "Loading...",
      "error": "Error",
      "success": "Success",
      "empty": "No data available"
    },
    "navigation": {
      "home": "Home",
      "back": "Back",
      "next": "Next",
      "previous": "Previous"
    }
  },
  "dashboard": {
    "overview": {
      "title": "Dashboard Overview",
      "description": "Monitor your key metrics and performance"
    },
    "stats": {
      "totalUsers": "Total Users",
      "revenue": "Revenue",
      "growth": "Growth",
      "conversion": "Conversion Rate"
    }
  }
}
```

### Key Naming Conventions
- **camelCase**: Use camelCase for all keys
- **Descriptive**: Keys should describe content, not location
- **Nested**: Group related translations logically
- **Consistent**: Use consistent patterns across features

```json
// ✅ Good - Descriptive and organized
{
  "forms": {
    "user": {
      "title": "User Information",
      "fields": {
        "firstName": "First Name",
        "lastName": "Last Name",
        "email": "Email Address"
      },
      "validation": {
        "required": "This field is required",
        "emailInvalid": "Please enter a valid email address"
      }
    }
  }
}

// ❌ Bad - Non-descriptive and flat
{
  "title1": "User Info",
  "field1": "Name",
  "error1": "Required"
}
```

## 🔧 Implementation Patterns

### Server Components
Use `getTranslations` from `next-intl/server`:

```typescript
// ✅ Good - Server component with translations
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

interface PageProps {
  params: {
    locale: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = await getTranslations('metadata');
  
  return {
    title: t('dashboard.title'),
    description: t('dashboard.description'),
  };
}

export default async function DashboardPage({ params }: PageProps) {
  const t = await getTranslations('dashboard');
  const nav = await getTranslations('navigation');
  
  return (
    <div>
      <h1>{t('overview.title')}</h1>
      <p>{t('overview.description')}</p>
      <nav>
        <a href="/">{nav('home')}</a>
        <a href="/profile">{nav('profile')}</a>
      </nav>
    </div>
  );
}
```

### Client Components
Use `useTranslations` hook:

```typescript
// ✅ Good - Client component with translations
'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function UserForm() {
  const t = useTranslations('forms.user');
  const common = useTranslations('common');
  const [loading, setLoading] = useState(false);

  return (
    <form>
      <h2>{t('title')}</h2>
      
      <div>
        <label>{t('fields.firstName')}</label>
        <input type="text" required />
      </div>
      
      <div>
        <label>{t('fields.email')}</label>
        <input type="email" required />
      </div>
      
      <button type="submit" disabled={loading}>
        {loading ? common('states.loading') : common('actions.save')}
      </button>
    </form>
  );
}
```

### Dynamic Values and Interpolation
Use translation parameters for dynamic content:

```typescript
// Translation file
{
  "welcome": "Welcome back, {name}!",
  "itemCount": "You have {count, plural, =0 {no items} =1 {one item} other {# items}}",
  "lastLogin": "Last login: {date, date, medium}"
}

// Component usage
const t = useTranslations('user');

return (
  <div>
    <h1>{t('welcome', { name: user.name })}</h1>
    <p>{t('itemCount', { count: items.length })}</p>
    <p>{t('lastLogin', { date: user.lastLoginDate })}</p>
  </div>
);
```

## 🗺️ Navigation and Routing

### Internationalized Links
Use the internationalized `Link` component:

```typescript
import { Link } from '@/i18n/navigation';

// ✅ Good - Internationalized navigation
export function Navigation() {
  const t = useTranslations('navigation');
  
  return (
    <nav>
      <Link href="/">{t('home')}</Link>
      <Link href="/dashboard">{t('dashboard')}</Link>
      <Link href="/profile">{t('profile')}</Link>
      <Link href="/settings">{t('settings')}</Link>
    </nav>
  );
}
```

### Programmatic Navigation
Use the internationalized `useRouter`:

```typescript
import { useRouter } from '@/i18n/navigation';

export function LoginForm() {
  const router = useRouter();
  const t = useTranslations('auth');
  
  const handleSubmit = async (formData: FormData) => {
    try {
      await login(formData);
      router.push('/dashboard'); // Automatically uses current locale
    } catch (error) {
      // Handle error
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <h1>{t('signIn.title')}</h1>
      {/* Form fields */}
    </form>
  );
}
```

## 🔄 Locale Switching

### Language Switcher Component
```typescript
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';

const languages = [
  { code: 'pt-BR', name: 'Português', flag: '🇧🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' }
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <select 
      value={locale} 
      onChange={(e) => handleLanguageChange(e.target.value)}
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.flag} {lang.name}
        </option>
      ))}
    </select>
  );
}
```

## 📝 Content Guidelines

### Translation Quality
- **Natural language**: Translations should sound natural, not literal
- **Cultural adaptation**: Adapt content for cultural context
- **Consistent terminology**: Use consistent terms throughout the app
- **Professional tone**: Maintain professional, friendly tone

### Portuguese (pt-BR) Guidelines
- **Formal tone**: Use "você" instead of "tu"
- **Brazilian terms**: Use Brazilian Portuguese variants
- **Currency**: Use "R$" for currency symbols
- **Date format**: DD/MM/YYYY format

```json
// ✅ Good - Brazilian Portuguese
{
  "welcome": "Bem-vindo ao painel administrativo",
  "currency": "R$ {amount}",
  "date": "Data: {date}",
  "formality": "Por favor, preencha suas informações"
}

// ❌ Bad - European Portuguese or informal
{
  "welcome": "Bem-vindo ao painel administrativo",
  "currency": "€ {amount}",
  "formality": "Preenche as tuas informações"
}
```

### English Guidelines
- **US English**: Use American English spelling and terms
- **Clear and concise**: Keep translations clear and direct
- **Accessibility**: Use accessible language
- **Consistent voice**: Maintain consistent voice and tone

```json
// ✅ Good - US English
{
  "color": "Color",
  "organization": "Organization",
  "analyze": "Analyze"
}

// ❌ Bad - British English
{
  "colour": "Colour",
  "organisation": "Organisation",
  "analyse": "Analyse"
}
```

## 🔍 Validation and Testing

### Missing Translation Detection
```typescript
// Custom hook to detect missing translations
export function useMissingTranslations() {
  const t = useTranslations();
  
  const safeTranslate = (key: string, fallback?: string) => {
    try {
      const translation = t(key);
      if (translation === key) {
        console.warn(`Missing translation for key: ${key}`);
        return fallback || key;
      }
      return translation;
    } catch (error) {
      console.error(`Translation error for key ${key}:`, error);
      return fallback || key;
    }
  };
  
  return safeTranslate;
}
```

### Translation Completeness Check
Create a utility to check translation completeness:

```typescript
// utils/check-translations.ts
export function checkTranslationCompleteness() {
  const ptBR = require('../../messages/pt-BR.json');
  const en = require('../../messages/en.json');
  
  const flattenObject = (obj: any, prefix = ''): string[] => {
    return Object.keys(obj).reduce((acc: string[], key) => {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object') {
        acc.push(...flattenObject(obj[key], newKey));
      } else {
        acc.push(newKey);
      }
      return acc;
    }, []);
  };
  
  const ptBRKeys = flattenObject(ptBR);
  const enKeys = flattenObject(en);
  
  const missingInEn = ptBRKeys.filter(key => !enKeys.includes(key));
  const missingInPtBR = enKeys.filter(key => !ptBRKeys.includes(key));
  
  if (missingInEn.length > 0) {
    console.warn('Missing English translations:', missingInEn);
  }
  
  if (missingInPtBR.length > 0) {
    console.warn('Missing Portuguese translations:', missingInPtBR);
  }
  
  return {
    complete: missingInEn.length === 0 && missingInPtBR.length === 0,
    missingInEn,
    missingInPtBR
  };
}
```

## 🚨 Common Anti-patterns

### Hardcoded Text
```typescript
// ❌ Bad - Hardcoded text
export function Header() {
  return (
    <header>
      <h1>Dashboard</h1>
      <button>Logout</button>
    </header>
  );
}

// ✅ Good - Translated text
export function Header() {
  const t = useTranslations('common');
  
  return (
    <header>
      <h1>{t('navigation.dashboard')}</h1>
      <button>{t('actions.logout')}</button>
    </header>
  );
}
```

### Key Fragmentation
```typescript
// ❌ Bad - Fragmented translation keys
{
  "save": "Save",
  "saveButton": "Save",
  "saveAction": "Save",
  "buttonSave": "Save"
}

// ✅ Good - Organized structure
{
  "common": {
    "actions": {
      "save": "Save"
    }
  }
}
```

### Locale-specific Code
```typescript
// ❌ Bad - Locale-specific logic in components
export function PriceDisplay({ amount }: { amount: number }) {
  const locale = useLocale();
  
  if (locale === 'pt-BR') {
    return <span>R$ {amount}</span>;
  } else {
    return <span>${amount}</span>;
  }
}

// ✅ Good - Translation-based formatting
export function PriceDisplay({ amount }: { amount: number }) {
  const t = useTranslations('common');
  
  return <span>{t('currency', { amount })}</span>;
}

// Translation files:
// pt-BR.json: { "common": { "currency": "R$ {amount}" } }
// en.json: { "common": { "currency": "${amount}" } }
```

## 📋 Internationalization Checklist

### ✅ Implementation
- [ ] All user-facing text uses translation keys
- [ ] Server components use `getTranslations`
- [ ] Client components use `useTranslations`
- [ ] Navigation uses internationalized routing
- [ ] No hardcoded text remains

### ✅ Translation Files
- [ ] Both pt-BR and en files are updated
- [ ] Translation keys follow naming conventions
- [ ] Hierarchical organization is maintained
- [ ] Interpolation is used for dynamic content
- [ ] Pluralization rules are implemented

### ✅ Quality
- [ ] Translations are natural and contextual
- [ ] Cultural adaptations are considered
- [ ] Consistent terminology is used
- [ ] Professional tone is maintained
- [ ] No missing translations exist

### ✅ Functionality
- [ ] Locale switching works correctly
- [ ] URLs are properly internationalized
- [ ] Metadata is translated
- [ ] Error messages are translated
- [ ] Form validation messages are translated

### ✅ Security & Privacy
- [ ] No sensitive data in translation keys
- [ ] Translation files don't expose internal information
- [ ] Error messages are generic and don't reveal system details
- [ ] User input is properly sanitized before translation
- [ ] No XSS vulnerabilities in translated content
- [ ] Translation interpolation is secure
- [ ] No credential or token leaks in translations
- [ ] Proper encoding for special characters

## 🔧 Development Workflow

### Adding New Features
1. **Plan translations**: Identify all text that needs translation
2. **Create keys**: Add keys to both language files
3. **Implement**: Use translation hooks in components
4. **Test**: Verify both languages work correctly
5. **Review**: Ensure translation quality

### Translation Updates
1. **Identify changes**: Document what text has changed
2. **Update keys**: Modify translation files
3. **Maintain consistency**: Keep both languages in sync
4. **Test thoroughly**: Verify all affected areas
5. **Deploy carefully**: Ensure no missing translations

### Quality Assurance
- **Native speakers**: Have native speakers review translations
- **Context testing**: Test translations in actual UI context
- **Edge cases**: Test with long text, special characters
- **Responsive design**: Ensure text fits in different layouts
- **Accessibility**: Verify screen reader compatibility

## 📖 Resources and Tools

### Development Tools
- **next-intl**: Primary internationalization library
- **VS Code extensions**: i18n Ally for translation management
- **Translation checkers**: Custom utilities for completeness
- **Linting**: ESLint rules for translation usage

### Translation Management
- **File organization**: Maintain clear file structure
- **Version control**: Track translation changes carefully
- **Collaboration**: Use clear processes for translation updates
- **Documentation**: Document translation decisions and context