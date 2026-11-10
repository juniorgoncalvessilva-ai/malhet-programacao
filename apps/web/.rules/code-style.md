# Code Style and Standards

## 🎯 TypeScript Standards

### Strict Type Safety
- **No `any` types**: Use `unknown` or specific types instead
- **Proper interfaces**: Define clear interfaces for all component props
- **Union types**: Use for constrained values (variants, sizes, etc.)
- **Generic types**: Implement for reusable components

```typescript
// ✅ Good - Strict typing
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  children: React.ReactNode;
}

// ❌ Bad - Loose typing
interface ButtonProps {
  [key: string]: any;
  children: any;
}
```

### Interface Patterns
- **Extend HTML attributes**: Always extend appropriate HTML element interfaces
- **Optional props**: Use `?` for optional properties
- **Required children**: Explicitly type children when required
- **Event handlers**: Use React's built-in event types

```typescript
// ✅ Good - Proper interface extension
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

// ✅ Good - Event handler typing
interface FormProps {
  onSubmit: (data: FormData) => void;
  onCancel?: () => void;
}
```

### Generic Components
```typescript
// ✅ Good - Generic component for type safety
interface SelectProps<T> extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: T; label: string }>;
  onValueChange: (value: T) => void;
}

function Select<T extends string | number>({ 
  options, 
  onValueChange, 
  ...props 
}: SelectProps<T>) {
  // Implementation
}
```

## 🎨 Component Architecture

### CVA (Class Variance Authority) Pattern
All UI components must use CVA for styling variants:

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base classes
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
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

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
```

### forwardRef Pattern
- **Always use forwardRef**: For components that wrap HTML elements
- **Proper ref typing**: Use appropriate HTML element types
- **Display name**: Always set displayName for debugging

```typescript
// ✅ Good - Proper forwardRef usage
const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = "Input";
```

## 🎪 React Patterns

### Server vs Client Components
- **Default to Server Components**: Use unless client-side interactivity is needed
- **Mark client components**: Use `'use client'` directive
- **Minimize client components**: Keep client-side JavaScript minimal

```typescript
// ✅ Good - Server Component (default)
// app/[locale]/dashboard/page.tsx
import { getTranslations } from 'next-intl/server';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <ServerDataComponent />
    </div>
  );
}

// ✅ Good - Client Component when needed
// components/theme-toggle.tsx
'use client';

import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Client-side logic here
}
```

### Custom Hooks
- **Extract reusable logic**: Move complex logic to custom hooks
- **Type parameters**: Use generics for flexible hooks
- **Return objects**: Return objects instead of arrays for named returns

```typescript
// ✅ Good - Typed custom hook
function useLocalStorage<T>(
  key: string,
  initialValue: T
): {
  value: T;
  setValue: (value: T | ((val: T) => T)) => void;
  removeValue: () => void;
} {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return { value: storedValue, setValue, removeValue };
}
```

### State Management
- **Local state first**: Use useState for component-specific state
- **Context for shared state**: Use React Context for component tree state
- **Custom hooks for complex logic**: Extract complex state logic
- **Server state separation**: Keep server and client state separate

```typescript
// ✅ Good - Context pattern
interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

## 🎨 Styling Standards

### Tailwind CSS Best Practices
- **Utility-first**: Use Tailwind utilities for all styling
- **No custom CSS**: Avoid writing custom CSS unless absolutely necessary
- **Responsive design**: Always consider mobile-first design
- **Dark mode support**: All components must support dark mode

```typescript
// ✅ Good - Well-organized Tailwind classes
<div className={cn(
  // Layout
  "flex items-center justify-between",
  // Spacing
  "p-4 gap-2",
  // Background and borders
  "bg-white dark:bg-gray-800",
  "border border-gray-200 dark:border-gray-700",
  // Border radius and shadows
  "rounded-lg shadow-sm",
  // Hover states
  "hover:shadow-md transition-shadow",
  // Responsive
  "md:p-6 lg:gap-4"
)}>
```

### Class Organization
Group Tailwind classes logically:
1. Layout (flex, grid, position)
2. Spacing (margin, padding, gap)
3. Sizing (width, height)
4. Typography (font, text)
5. Colors (background, text, border)
6. Effects (shadow, opacity, transform)
7. States (hover, focus, disabled)
8. Responsive modifiers

### Conditional Classes
```typescript
// ✅ Good - Using cn() utility for conditional classes
<button 
  className={cn(
    "px-4 py-2 rounded-md font-medium transition-colors",
    // Variant conditions
    variant === 'primary' && "bg-blue-600 text-white hover:bg-blue-700",
    variant === 'secondary' && "bg-gray-200 text-gray-900 hover:bg-gray-300",
    // State conditions
    isLoading && "opacity-50 cursor-not-allowed",
    disabled && "opacity-50 pointer-events-none",
    // Size conditions
    size === 'sm' && "px-2 py-1 text-sm",
    size === 'lg' && "px-6 py-3 text-lg"
  )}
>
```

## 🌍 Internationalization

### Translation Usage
- **No hardcoded text**: All user-facing text must be translatable
- **Proper namespacing**: Use logical namespace organization
- **Both languages**: Always add keys to both pt-BR and en files

```typescript
// ✅ Good - Proper translation usage
const t = useTranslations('dashboard.overview');

return (
  <div>
    <h1>{t('title')}</h1>
    <p>{t('description')}</p>
    <Button>{t('actions.save')}</Button>
  </div>
);

// ✅ Good - Server component translations
const t = await getTranslations('dashboard.overview');
```

### Translation Key Structure
```json
{
  "dashboard": {
    "overview": {
      "title": "Dashboard Overview",
      "description": "Monitor your key metrics",
      "actions": {
        "save": "Save Changes",
        "cancel": "Cancel",
        "export": "Export Data"
      }
    }
  }
}
```

## 🔐 Security and Error Handling

### Input Validation
- **Validate all inputs**: Both client and server-side validation
- **Sanitize data**: Clean user inputs before processing
- **Type checking**: Use TypeScript for compile-time validation

```typescript
// ✅ Good - Proper validation
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

interface FormData {
  email: string;
  password: string;
}

function validateFormData(data: unknown): data is FormData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'email' in data &&
    'password' in data &&
    typeof (data as any).email === 'string' &&
    typeof (data as any).password === 'string' &&
    validateEmail((data as any).email)
  );
}
```

### Error Handling
- **Try-catch blocks**: Wrap async operations
- **User-friendly messages**: Don't expose internal errors
- **Loading states**: Show appropriate loading indicators

```typescript
// ✅ Good - Comprehensive error handling
async function submitForm(data: FormData) {
  setLoading(true);
  setError(null);
  
  try {
    const response = await apiClient.post('/users', data);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    setSuccess(true);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    setError(message);
    console.error('Form submission error:', error);
  } finally {
    setLoading(false);
  }
}
```

## 📝 Code Documentation

### JSDoc Comments
- **Component documentation**: Document complex components
- **Function documentation**: Document utility functions
- **Type documentation**: Document complex types

```typescript
/**
 * A reusable button component with multiple variants and sizes.
 * 
 * @example
 * ```tsx
 * <Button variant="primary" size="lg" onClick={handleClick}>
 *   Click me
 * </Button>
 * ```
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The visual style variant of the button */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** The size of the button */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether the button is in a loading state */
  isLoading?: boolean;
}
```

### Code Comments
- **Explain why, not what**: Focus on business logic and decisions
- **Complex algorithms**: Document complex logic
- **Temporary code**: Mark with TODO/FIXME

```typescript
// ✅ Good - Explains the why
// Using setTimeout to avoid blocking the main thread during heavy computation
setTimeout(() => {
  processLargeDataset(data);
}, 0);

// TODO: Replace with Web Worker for better performance
// FIXME: This approach doesn't work in Safari < 14
```

## 🚨 Common Anti-patterns to Avoid

### TypeScript Anti-patterns
```typescript
// ❌ Bad - Using any
function processData(data: any) {
  return data.someProperty;
}

// ✅ Good - Proper typing
interface DataType {
  someProperty: string;
}

function processData(data: DataType) {
  return data.someProperty;
}
```

### React Anti-patterns
```typescript
// ❌ Bad - Mutating props
function Component({ items }: { items: string[] }) {
  items.push('new item'); // Don't mutate props
  return <div>{items.join(', ')}</div>;
}

// ✅ Good - Creating new array
function Component({ items }: { items: string[] }) {
  const updatedItems = [...items, 'new item'];
  return <div>{updatedItems.join(', ')}</div>;
}
```

### Styling Anti-patterns
```typescript
// ❌ Bad - Inline styles
<div style={{ backgroundColor: '#ffffff', padding: '16px' }}>

// ❌ Bad - Random class names
<div className="mt-5 bg-blue-500 p-4">

// ✅ Good - Semantic, organized classes
<div className={cn(
  "bg-white dark:bg-gray-800",
  "p-4 md:p-6",
  "rounded-lg shadow-sm"
)}>
```

## 📋 Code Review Checklist

### ✅ TypeScript
- [ ] No `any` types used
- [ ] Proper interface definitions
- [ ] Generic types where appropriate
- [ ] Proper event handler typing

### ✅ React
- [ ] Appropriate use of Server vs Client components
- [ ] Proper forwardRef usage
- [ ] No prop mutation
- [ ] Appropriate hook usage

### ✅ Styling
- [ ] Only Tailwind classes used
- [ ] Dark mode support
- [ ] Responsive design
- [ ] Organized class structure

### ✅ Performance
- [ ] No unnecessary re-renders
- [ ] Proper memoization
- [ ] Lazy loading where appropriate
- [ ] Optimized bundle size

### ✅ Accessibility
- [ ] Proper ARIA attributes
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Color contrast compliance

### ✅ Security
- [ ] Input validation implemented
- [ ] No exposed sensitive data
- [ ] Proper error handling
- [ ] XSS prevention measures
- [ ] Authentication checks in place
- [ ] No secrets in code or logs
- [ ] Server-side validation for all inputs
- [ ] Generic error messages to users
- [ ] File upload security (if applicable)
- [ ] Rate limiting considerations