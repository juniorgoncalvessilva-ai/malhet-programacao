# 🏪 Frontend State Management Implementation Guide

## Context
You are implementing state management for the AI Coders Starter Kit using:
- **Zustand** for global CLIENT state management (UI, preferences, theme)
- **TanStack Query** for SERVER state management (API data, caching) - ✅ ALREADY IMPLEMENTED
- TypeScript for type safety
- Persistent storage with localStorage
- Immer for immutable updates
- DevTools integration

> **⚠️ IMPORTANT**: This project uses a dual state management approach:
> - **Zustand**: Client-side state (UI, theme, notifications, preferences)
> - **TanStack Query**: Server-side state (API data, users, posts, etc.)
> 
> See `/docs/05-features/tanstack-query.md` for server state management

## Project Structure Reference
- Stores location: `/src/store/`
- Store types: `/src/store/types.ts`
- Store hooks: `/src/store/index.ts`
- Providers: `/src/providers/store-provider.tsx`

## Implementation Requirements

### 1. Available Stores
```typescript
// App Store - Main application state
import { useAppStore, useAppActions, useUser, usePreferences } from '@/store';

// Auth Store - Authentication state
import { useAuthStore, useAuth, useAuthActions } from '@/store';

// UI Store - Interface state
import { useUIStore, useUIActions, useTheme, useSidebarState } from '@/store';
```

### 2. Using Stores in Components
```typescript
"use client";

import { useAppStore, useUIActions } from '@/store';

export function MyComponent() {
  // Optimized selectors (only re-renders when these specific values change)
  const { user, isLoading, notifications } = useAppStore((state) => ({
    user: state.user,
    isLoading: state.isLoading,
    notifications: state.notifications,
  }));

  // Action hooks
  const { showToast, setTheme, toggleSidebar } = useUIActions();
  const { updateUser, addNotification } = useAppActions();

  const handleAction = () => {
    showToast({
      type: 'success',
      message: 'Action completed successfully!',
    });
  };

  return (
    <div>
      {isLoading && <LoadingSpinner />}
      <button onClick={handleAction}>Execute Action</button>
    </div>
  );
}
```

### 3. Store Patterns

#### App Store Usage
```typescript
import { useAppStore, useAppActions } from '@/store';

// Reading state
const { user, preferences, notifications } = useAppStore((state) => ({
  user: state.user,
  preferences: state.preferences,
  notifications: state.notifications,
}));

// Actions
const { 
  setUser, 
  updatePreferences, 
  addNotification,
  clearAllNotifications 
} = useAppActions();

// Example usage
const handleUserUpdate = (updates: Partial<User>) => {
  updateUser(updates);
  addNotification({
    type: 'success',
    title: 'Profile Updated',
    message: 'Your profile has been updated successfully',
  });
};
```

#### UI Store Usage
```typescript
import { useUIActions, useTheme, useLoading } from '@/store';

const theme = useTheme();
const isLoading = useLoading('api-call');
const {
  setTheme,
  showToast,
  openModal,
  setLoading,
  toggleSidebar
} = useUIActions();

// Theme management
const toggleTheme = () => {
  const newTheme = theme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
};

// Loading states
const handleApiCall = async () => {
  setLoading('api-call', true);
  try {
    await apiCall();
    showToast({
      type: 'success',
      message: 'Data loaded successfully',
    });
  } catch (error) {
    showToast({
      type: 'error',
      message: 'Failed to load data',
    });
  } finally {
    setLoading('api-call', false);
  }
};

// Modal management
const openUserModal = () => {
  openModal({
    component: 'UserModal',
    props: { userId: user.id },
    size: 'lg',
  });
};
```

#### Auth Store Usage
```typescript
import { useAuth, useAuthActions } from '@/store';

const { isSignedIn, user, session } = useAuth();
const { setAuth, clearAuth, updateUser } = useAuthActions();

// Auth state is automatically synced with Clerk
// Manual updates only needed for custom logic
const handleProfileUpdate = (profileData) => {
  updateUser(profileData);
};
```

### 4. Creating Custom Store Slices
```typescript
// For specific domain logic, extend existing stores or create new ones
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface ProductStore {
  products: Product[];
  selectedProduct: Product | null;
  filters: ProductFilters;
  
  setProducts: (products: Product[]) => void;
  selectProduct: (product: Product) => void;
  updateFilters: (filters: Partial<ProductFilters>) => void;
  clearSelection: () => void;
}

export const useProductStore = create<ProductStore>()(
  devtools(
    persist(
      immer((set) => ({
        products: [],
        selectedProduct: null,
        filters: {},
        
        setProducts: (products) => set({ products }),
        
        selectProduct: (product) => set({ selectedProduct: product }),
        
        updateFilters: (newFilters) => set((state) => {
          Object.assign(state.filters, newFilters);
        }),
        
        clearSelection: () => set({ selectedProduct: null }),
      })),
      {
        name: 'product-store',
        partialize: (state) => ({ filters: state.filters }),
      }
    ),
    { name: 'product-store' }
  )
);
```

### 5. Performance Patterns
```typescript
// ✅ Good - Specific selectors
const user = useUser(); // Pre-defined optimized selector
const theme = useTheme(); // Pre-defined optimized selector

// ✅ Good - Multiple related values
const { isLoading, error } = useAppStore((state) => ({
  isLoading: state.isLoading,
  error: state.error,
}));

// ❌ Bad - Selecting entire store
const store = useAppStore(); // Re-renders on any change

// ✅ Good - Memoized complex selectors
import { useMemo } from 'react';

const filteredNotifications = useAppStore((state) => 
  useMemo(() => 
    state.notifications.filter(n => !n.read),
    [state.notifications]
  )
);
```

### 6. When to Use TanStack Query vs Zustand

#### Use TanStack Query For:
```typescript
// ✅ Server data - Use TanStack Query
import { useCurrentUserProfile } from '@/hooks/queries/useUser';
import { usePosts } from '@/hooks/queries/usePosts';
import { useCreatePost } from '@/hooks/mutations/usePosts';

export function Dashboard() {
  // Server data with automatic caching
  const { data: profile, isLoading } = useCurrentUserProfile();
  const { data: posts = [] } = usePosts();
  const createPost = useCreatePost();
  
  return <div>Posts: {posts.length}</div>;
}
```

#### Use Zustand For:
```typescript
// ✅ Client state - Use Zustand
import { useTheme, useShowToast, useSidebarOpen } from '@/store';

export function UIControls() {
  const theme = useTheme();
  const showToast = useShowToast();
  const sidebarOpen = useSidebarOpen();
  
  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    showToast({
      type: 'success',
      message: `Theme changed to ${newTheme}`
    });
  };
  
  return <button onClick={handleThemeToggle}>Toggle Theme</button>;
}
```

#### Integration Example:
```typescript
// ✅ Using both together
import { useCreatePost } from '@/hooks/mutations/usePosts'; // TanStack Query
import { useShowToast } from '@/store'; // Zustand

export function CreatePostForm() {
  const createPost = useCreatePost(); // Server operation
  const showToast = useShowToast(); // UI feedback
  
  const handleSubmit = async (data) => {
    try {
      await createPost.mutateAsync(data);
      // Toast is already handled in the mutation hook
    } catch (error) {
      // Error toast is also handled in the mutation hook
    }
  };
}
```

### 7. Form Integration
```typescript
import { useForm } from 'react-hook-form';
import { useAppActions, useUIActions } from '@/store';

export function UserForm() {
  const { updateUser } = useAppActions();
  const { showToast } = useUIActions();
  
  const { register, handleSubmit } = useForm();
  
  const onSubmit = async (data) => {
    try {
      await updateUserApi(data);
      updateUser(data);
      showToast({
        type: 'success',
        message: 'Profile updated successfully',
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to update profile',
      });
    }
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      <button type="submit">Update</button>
    </form>
  );
}
```

### 8. Store Initialization and Cleanup
```typescript
// In your root layout or main app component
import { useStoreInitialization } from '@/store';

export function App({ children }) {
  // Automatically initializes all stores
  useStoreInitialization();
  
  return <>{children}</>;
}

// Manual store reset (e.g., on logout)
import { useStoreReset } from '@/store';

export function LogoutButton() {
  const resetStores = useStoreReset();
  
  const handleLogout = () => {
    resetStores();
    // Redirect to login
  };
  
  return <button onClick={handleLogout}>Logout</button>;
}
```

## Available Store Actions

### App Store Actions
- `setUser(user)` - Set current user
- `updateUser(updates)` - Update user partially
- `updatePreferences(prefs)` - Update preferences
- `addNotification(notification)` - Add notification
- `markNotificationAsRead(id)` - Mark as read
- `clearAllNotifications()` - Clear all

### UI Store Actions
- `setTheme(theme)` - Set theme
- `toggleSidebar()` - Toggle sidebar
- `showToast(toast)` - Show toast message
- `openModal(modal)` - Open modal
- `closeModal(id)` - Close modal
- `setLoading(key, loading)` - Set loading state

### Auth Store Actions
- `setAuth(authData)` - Set auth state
- `clearAuth()` - Clear auth state
- `updateUser(updates)` - Update user info

## DevTools and Debugging

### Enable DevTools Component
```typescript
import { StoreDevtools } from '@/components/Store/StoreDevtools';

export default function Layout({ children }) {
  return (
    <>
      {children}
      {/* Only shows in development */}
      <StoreDevtools />
    </>
  );
}
```

### Manual State Inspection
```typescript
// Get current store state
const currentState = useAppStore.getState();
console.log('Current app state:', currentState);

// Subscribe to changes
const unsubscribe = useAppStore.subscribe(
  (state) => console.log('State changed:', state),
  (state) => state.user // Only watch user changes
);

// Cleanup subscription
unsubscribe();
```

## Testing Patterns

### Mock Stores for Tests
```typescript
import { useAppStore } from '@/store';

// Mock store state for tests
beforeEach(() => {
  useAppStore.setState({
    user: mockUser,
    isLoading: false,
    notifications: [],
  });
});

// Test component with store
const { render } = renderWithProviders(<MyComponent />);
```

### Test Store Actions
```typescript
import { renderHook, act } from '@testing-library/react';
import { useAppActions } from '@/store';

test('should add notification', () => {
  const { result } = renderHook(() => useAppActions());
  
  act(() => {
    result.current.addNotification({
      type: 'success',
      title: 'Test',
      message: 'Test message',
    });
  });
  
  const notifications = useAppStore.getState().notifications;
  expect(notifications).toHaveLength(1);
});
```

## Best Practices

### 1. Selector Optimization
- Use specific selectors instead of selecting entire store
- Group related values in single selector
- Use pre-defined selector hooks when available

### 2. Action Organization
- Keep actions focused and atomic
- Use action hooks instead of direct store access
- Handle side effects in custom hooks

### 3. Type Safety
- Always use TypeScript interfaces
- Leverage auto-generated types from stores
- Validate action parameters

### 4. Performance
- Minimize re-renders with optimized selectors
- Use shallow equality for object selections
- Debounce frequent updates

## Documentation References
- State management guide: `/docs/05-features/zustand-state-management.md`
- Store examples: `/src/components/StateManagement/Zustand.tsx`
- Store implementation: `/src/store/`

## Testing Checklist
- [ ] Component renders with store data
- [ ] Actions update state correctly
- [ ] Selectors are optimized
- [ ] Loading states work
- [ ] Error handling implemented
- [ ] Store persists correctly
- [ ] DevTools integration works
- [ ] No memory leaks