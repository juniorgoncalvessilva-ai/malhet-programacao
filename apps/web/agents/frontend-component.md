# 🎨 Frontend Component Implementation Guide

## Context
You are creating a React component for the AI Coders Starter Kit project with:
- Next.js 15.3.3 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Shadcn/ui components available
- Dark mode support
- Internationalization (next-intl)

## Project Structure Reference
- Components location: `/src/components/`
  - Common: `/src/components/Common/`
  - Dashboard: `/src/components/Dashboard/`
  - Forms: `/src/components/Forms/`
  - Tables: `/src/components/Tables/`
  - UI: `/src/components/ui/`
- Hooks: `/src/hooks/`
- Types: `/src/types/`
- Translations: `/src/i18n/locales/`

## Implementation Requirements

### 1. Component Structure
```typescript
"use client"; // Only if using client-side features

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface ComponentNameProps {
  className?: string;
  // ... other props
}

export const ComponentName: FC<ComponentNameProps> = ({
  className,
  ...props
}) => {
  const t = useTranslations('ComponentName');
  
  return (
    <div className={cn("base-classes", className)}>
      {/* Component content */}
    </div>
  );
};
```

### 2. Styling Guidelines
- Use Tailwind CSS classes
- Support dark mode: `dark:bg-boxdark dark:text-white`
- Mobile-first responsive: `sm:`, `md:`, `lg:`, `xl:`
- Use existing color variables from the theme
- Common patterns:
  ```css
  /* Card/Box */
  "rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark"
  
  /* Button */
  "rounded-md bg-primary px-4 py-2 text-white hover:bg-opacity-90"
  
  /* Input */
  "w-full rounded-md border border-stroke bg-transparent px-4 py-2 dark:border-dark-3"
  ```

### 3. State Management
- Use React hooks for local state
- Use Zustand for global state management
- Import stores from `/src/store/`
- Custom hooks in `/src/hooks/`

```typescript
// Local state
const [value, setValue] = useState('');

// Global state with Zustand
import { useAppStore, useUIActions } from '@/store';

const { user, isLoading } = useAppStore((state) => ({
  user: state.user,
  isLoading: state.isLoading,
}));

const { showToast, setTheme } = useUIActions();
```

### 4. Data Fetching
```typescript
// Server Component (default)
async function getData() {
  const res = await fetch('/api/data');
  return res.json();
}

// Client Component with SWR/React Query
import useSWR from 'swr';
const { data, error, isLoading } = useSWR('/api/data', fetcher);
```

### 5. Internationalization
```typescript
// Use translations
const t = useTranslations('namespace');

// In JSX
<h1>{t('title')}</h1>

// Add to locale files:
// /src/i18n/locales/pt/namespace.json
// /src/i18n/locales/en/namespace.json
```

### 6. TypeScript Types
- Define interfaces for all props
- Export types when reusable
- Use existing types from `/src/types/`

### 7. Component Composition
- Keep components small and focused
- Extract reusable parts
- Use composition over inheritance
- Follow existing patterns in the codebase

### 8. Accessibility
- Use semantic HTML
- Add ARIA labels where needed
- Ensure keyboard navigation
- Test with screen readers

### 9. Performance
- Use `memo` for expensive components
- Lazy load when appropriate
- Optimize images with Next.js Image
- Avoid unnecessary re-renders

## Available UI Components
From `/src/components/ui/`:
- Button, Card, Dialog, Dropdown
- Form controls (Input, Select, Checkbox)
- Toast notifications (Sonner)
- Skeleton loaders
- And more...

## Documentation References
- Components guide: `/docs/04-components/componentes.md`
- Theme and styles: `/docs/04-components/tema-estilos.md`
- UI patterns: Check existing components for patterns

## Testing Checklist
- [ ] Component renders without errors
- [ ] Props are properly typed
- [ ] Dark mode works correctly
- [ ] Responsive on all screen sizes
- [ ] Translations are working
- [ ] Accessible markup
- [ ] No console errors

## Example Components to Reference
- `/src/components/Header/index.tsx`
- `/src/components/Sidebar/index.tsx`
- `/src/components/Forms/DatePicker/DatePickerOne.tsx`
- `/src/components/Dashboard/E-commerce.tsx`