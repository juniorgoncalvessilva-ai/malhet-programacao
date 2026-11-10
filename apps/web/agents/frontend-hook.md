# 🪝 Frontend Custom Hook Implementation Guide

## Context
You are creating a custom React hook for the AI Coders Starter Kit with:
- React 19.0.0 with Next.js 15.3.3
- TypeScript for type safety
- Proper error handling
- Loading states
- Supabase/API integration support

## Project Structure Reference
- Hooks location: `/src/hooks/`
- Types: `/src/types/`
- API utilities: `/src/lib/`
- Existing hooks to reference

## Implementation Patterns

### 1. Basic Hook Structure
```typescript
// /src/hooks/useExample.ts
"use client"; // Only if using browser APIs

import { useState, useEffect, useCallback } from 'react';

interface UseExampleOptions {
  initialValue?: string;
  autoFetch?: boolean;
}

interface UseExampleReturn {
  data: string | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useExample(options: UseExampleOptions = {}): UseExampleReturn {
  const { initialValue = '', autoFetch = true } = options;
  
  const [data, setData] = useState<string | null>(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Your async logic here
      const result = await someAsyncOperation();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [/* dependencies */]);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
}
```

### 2. API Fetch Hook
```typescript
// /src/hooks/useApiData.ts
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface ApiResponse<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApiData<T>(
  endpoint: string,
  options?: RequestInit
): ApiResponse<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [endpoint]);

  return { data, loading, error, refetch: fetchData };
}
```

### 3. Local Storage Hook
```typescript
// /src/hooks/useLocalStorage.ts
import { useState, useEffect } from 'react';

type SetValue<T> = T | ((val: T) => T);

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: SetValue<T>) => void] {
  // Get from local storage then parse stored json or return initialValue
  const readValue = (): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: SetValue<T>) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Save to local state
      setStoredValue(valueToStore);
      
      // Save to local storage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  useEffect(() => {
    setStoredValue(readValue());
  }, []);

  return [storedValue, setValue];
}
```

### 4. Debounce Hook
```typescript
// /src/hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage example
export function useSearchDebounce(searchTerm: string, delay = 500) {
  const debouncedSearch = useDebounce(searchTerm, delay);
  
  return debouncedSearch;
}
```

### 5. Window Size Hook
```typescript
// /src/hooks/useWindowSize.ts
import { useState, useEffect } from 'react';

interface WindowSize {
  width: number | undefined;
  height: number | undefined;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export function useWindowSize(): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: undefined,
    height: undefined,
    isMobile: false,
    isTablet: false,
    isDesktop: false,
  });

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setWindowSize({
        width,
        height,
        isMobile: width < 640,
        isTablet: width >= 640 && width < 1024,
        isDesktop: width >= 1024,
      });
    }

    // Call handler right away so state gets updated with initial window size
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
}
```

### 6. Supabase Query Hook
```typescript
// /src/hooks/useSupabaseQuery.ts
import { useState, useEffect } from 'react';
import { useSupabase } from './useSupabase';
import { PostgrestError } from '@supabase/supabase-js';

interface QueryOptions {
  table: string;
  select?: string;
  filters?: Array<{ column: string; operator: string; value: any }>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
}

interface QueryResult<T> {
  data: T[] | null;
  error: PostgrestError | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useSupabaseQuery<T = any>(
  options: QueryOptions
): QueryResult<T> {
  const supabase = useSupabase();
  const [data, setData] = useState<T[] | null>(null);
  const [error, setError] = useState<PostgrestError | null>(null);
  const [loading, setLoading] = useState(true);

  const executeQuery = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from(options.table)
        .select(options.select || '*');

      // Apply filters
      options.filters?.forEach(filter => {
        query = query.filter(
          filter.column,
          filter.operator,
          filter.value
        );
      });

      // Apply ordering
      if (options.orderBy) {
        query = query.order(
          options.orderBy.column,
          { ascending: options.orderBy.ascending ?? true }
        );
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data: result, error: queryError } = await query;

      if (queryError) {
        setError(queryError);
      } else {
        setData(result);
      }
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Unknown error',
        details: '',
        hint: '',
        code: ''
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeQuery();
  }, [
    options.table,
    JSON.stringify(options.filters),
    JSON.stringify(options.orderBy),
    options.limit
  ]);

  return { data, error, loading, refetch: executeQuery };
}
```

### 7. Form State Hook
```typescript
// /src/hooks/useFormState.ts
import { useState, useCallback, ChangeEvent } from 'react';

interface FormErrors {
  [key: string]: string;
}

export function useFormState<T extends Record<string, any>>(
  initialState: T,
  validate?: (values: T) => FormErrors
) {
  const [values, setValues] = useState<T>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      const newValue = type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : value;

      setValues(prev => ({ ...prev, [name]: newValue }));
      
      // Clear error when user starts typing
      if (errors[name]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    },
    [errors]
  );

  const handleBlur = useCallback((e: React.FocusEvent<any>) => {
    const { name } = e.target;
    setTouched(prev => new Set(prev).add(name));
    
    // Validate single field
    if (validate) {
      const validationErrors = validate(values);
      if (validationErrors[name]) {
        setErrors(prev => ({ ...prev, [name]: validationErrors[name] }));
      }
    }
  }, [values, validate]);

  const resetForm = useCallback(() => {
    setValues(initialState);
    setErrors({});
    setTouched(new Set());
  }, [initialState]);

  const validateForm = useCallback(() => {
    if (!validate) return true;
    
    const validationErrors = validate(values);
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  }, [values, validate]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    resetForm,
    validateForm,
    setValues,
    setErrors
  };
}
```

## Best Practices

### 1. Error Handling
- Always catch and handle errors gracefully
- Provide meaningful error messages
- Use error boundaries for critical hooks

### 2. Performance
- Use `useCallback` for function stability
- Memoize expensive computations with `useMemo`
- Clean up subscriptions and timers

### 3. TypeScript
- Define clear interfaces for options and returns
- Use generics for reusable hooks
- Export types when needed by consumers

### 4. Testing
- Keep hooks pure when possible
- Mock external dependencies
- Test edge cases and error states

### 5. Documentation
```typescript
/**
 * Custom hook for managing user preferences
 * @param key - The localStorage key to use
 * @param defaultValue - Default value if none exists
 * @returns {[T, (value: T) => void]} Current value and setter
 * @example
 * const [theme, setTheme] = usePreference('theme', 'light');
 */
export function usePreference<T>(...) { }
```

## Common Patterns

### Composition
```typescript
// Compose multiple hooks
export function useAuthenticatedData(endpoint: string) {
  const { user } = useUser();
  const { data, loading, error } = useApiData(endpoint, {
    headers: {
      Authorization: `Bearer ${user?.token}`
    }
  });
  
  return { data, loading, error, isAuthenticated: !!user };
}
```

### State Machine
```typescript
type Status = 'idle' | 'loading' | 'success' | 'error';

export function useAsyncState<T>() {
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  // ... implementation
}
```

## Testing Checklist
- [ ] Hook returns expected values
- [ ] State updates correctly
- [ ] Side effects cleaned up properly
- [ ] Error cases handled
- [ ] Loading states managed
- [ ] TypeScript types correct
- [ ] No memory leaks
- [ ] Works with SSR

## Example Hooks to Reference
- `/src/hooks/useNavigation.tsx`
- `/src/hooks/useSupabase.ts`
- `/src/hooks/useColorMode.tsx`
- `/src/hooks/useSidebar.tsx`