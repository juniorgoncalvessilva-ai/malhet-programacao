# 🏪 Global State Management Guide

## Context
This application uses **Zustand** for global state management. You should understand when to use global state vs local state and how to properly implement state management patterns.

## When to Use Global State vs Local State

### ✅ Use Global State (Zustand) When:

1. **Cross-Component Data Sharing**
   - Data needed by multiple unrelated components
   - State that persists across route navigation
   - User authentication status and profile
   - Application theme and UI preferences

2. **Application-Wide Configuration**
   - Language/locale settings
   - Theme (light/dark mode)
   - Sidebar state and layout preferences
   - Feature flags and app configuration

3. **Real-time Updates**
   - Toast notifications and alerts
   - Live data that multiple components display
   - WebSocket connection state
   - Collaborative features state

4. **Complex State Logic**
   - State with complex update patterns
   - State that needs computed/derived values
   - State with side effects (API calls, localStorage sync)

### ❌ Use Local State (useState) When:

1. **Component-Specific State**
   - Form input values (use react-hook-form)
   - Modal open/closed state for single modal
   - Local loading states for individual actions
   - Component animation states

2. **Temporary UI State**
   - Dropdown open/closed
   - Hover effects
   - Focus states
   - Component-internal toggles

3. **Simple, Isolated Data**
   - Counter values that don't affect other components
   - Input field validation state
   - Component-specific calculations

## Available Stores

```typescript
// Import stores and hooks
import { 
  // App Store - User data, preferences, notifications
  useUser, usePreferences, useNotifications,
  useAppActions, useAddNotification,
  
  // UI Store - Theme, sidebar, modals, toasts
  useTheme, useSetTheme, useSidebarOpen, useSidebarCollapsed,
  useShowToast, useToggleSidebar, useUIActions,
  
  // Auth Store - Authentication state
  useIsSignedIn, useAuthUser, useAuthLoading,
  
  // Locale Store - Language and internationalization
  useLocale, useSetLocale, useLocaleActions
} from '@/store';

// Sync hooks for external libraries
import { useThemeSync } from '@/hooks/useThemeSync';
import { useLocaleSync } from '@/hooks/useLocaleSync';
```

## Implementation Patterns

### Pattern 1: Simple State Access

```typescript
function ThemeToggleButton() {
  const currentTheme = useTheme();
  const setTheme = useSetTheme();
  const showToast = useShowToast();

  const handleToggle = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    showToast({
      type: 'success',
      message: `Switched to ${newTheme} theme`
    });
  };

  return (
    <button onClick={handleToggle}>
      {currentTheme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

### Pattern 2: Complex State Updates

```typescript
function UserProfileForm() {
  const user = useUser();
  const { updatePreferences, addNotification } = useAppActions();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData) => {
    setIsLoading(true);
    try {
      await updatePreferences({
        theme: formData.theme,
        language: formData.language,
        notifications: {
          email: formData.emailNotifications,
          push: formData.pushNotifications
        }
      });
      
      addNotification({
        type: 'success',
        title: 'Profile Updated',
        message: 'Your preferences have been saved'
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

### Pattern 3: Optimized Selectors

```typescript
// ✅ Good: Use individual selectors for better performance
function SidebarComponent() {
  const isOpen = useSidebarOpen();
  const isCollapsed = useSidebarCollapsed();
  const toggleSidebar = useToggleSidebar();
  
  // Component logic
}

// ❌ Avoid: Creating new objects in selectors
function BadSidebarComponent() {
  const sidebar = useUIStore(state => ({
    isOpen: state.sidebarOpen,
    isCollapsed: state.sidebarCollapsed
  }));
  // This creates a new object every render
}
```

### Pattern 4: Custom Computed State

```typescript
import { useMemo } from 'react';

function NotificationBadge() {
  const notifications = useNotifications();
  
  // Compute unread count (memoized)
  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read).length,
    [notifications]
  );

  if (unreadCount === 0) return null;

  return (
    <span className="badge">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
}
```

### Pattern 5: External Library Sync

```typescript
// Theme sync with next-themes
function AppWithThemeSync() {
  const { theme, setTheme } = useThemeSync(); // Syncs with next-themes
  
  return (
    <div className={`theme-${theme}`}>
      <button onClick={() => setTheme('dark')}>
        Dark Mode
      </button>
    </div>
  );
}

// Locale sync with next-intl
function LanguageSelector() {
  const { locale, setLocale, availableLocales } = useLocaleSync();
  
  return (
    <select value={locale} onChange={(e) => setLocale(e.target.value)}>
      {availableLocales.map(lang => (
        <option key={lang} value={lang}>{lang}</option>
      ))}
    </select>
  );
}
```

## Store Structure Guidelines

### App Store (`app-store.ts`)
- User profile data
- Application preferences
- Notifications array
- Global loading/error states

### UI Store (`ui-store.ts`)
- Theme (light/dark/system)
- Sidebar state (open/collapsed/pinned)
- Modal management
- Toast notifications
- Screen size detection

### Auth Store (`auth-store.ts`)
- Authentication status
- User permissions
- Session data

### Locale Store (`locale-store.ts`)
- Current language/locale
- Available languages
- RTL/LTR direction

## Best Practices

### 1. Performance Optimization

```typescript
// ✅ Use individual selectors
const theme = useTheme();
const user = useUser();

// ❌ Avoid object selectors  
const state = useUIStore(state => ({ theme: state.theme, sidebar: state.sidebarOpen })); // Re-renders on any change
```

### 2. Action Organization

```typescript
// ✅ Use provided action hooks
const showToast = useShowToast();
const addNotification = useAddNotification();

// ❌ Avoid direct store manipulation
useUIStore.setState({ toasts: [...toasts, newToast] });
```

### 3. Async Actions

```typescript
// ✅ Handle async properly in components
const updateUser = async (userData) => {
  setLoading(true);
  try {
    await api.updateUser(userData);
    updatePreferences(userData.preferences);
    showToast({ type: 'success', message: 'User updated!' });
  } catch (error) {
    showToast({ type: 'error', message: error.message });
  } finally {
    setLoading(false);
  }
};
```

### 4. Type Safety

```typescript
// ✅ Use proper TypeScript types
interface CustomNotification {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  duration?: number;
}

const showToast = useShowToast();
showToast({
  type: 'success',
  message: 'Operation completed'
} as CustomNotification);
```

## Common Use Cases

### 1. Theme Management
```typescript
const { theme, setTheme } = useThemeSync();
// Automatically syncs with next-themes and CSS classes
```

### 2. User Notifications
```typescript
const showToast = useShowToast();
const addNotification = useAddNotification();

// Temporary toast
showToast({ type: 'success', message: 'Saved!' });

// Persistent notification
addNotification({
  type: 'info',
  title: 'New Feature',
  message: 'Check out our new dashboard'
});
```

### 3. Sidebar Management
```typescript
const isOpen = useSidebarOpen();
const toggleSidebar = useToggleSidebar();

// Responsive sidebar handling included automatically
```

### 4. Language Switching
```typescript
const { locale, setLocale } = useLocaleSync();

// Changes locale and navigates to new URL
setLocale('pt-BR'); // Navigates to /pt-BR/current-page
```

## Testing Patterns

```typescript
import { renderWithProviders } from '@/test-utils';
import { useUIStore } from '@/store/ui-store';

test('theme toggle works', () => {
  const { getByRole } = renderWithProviders(<ThemeToggle />);
  
  // Initial state
  expect(useUIStore.getState().theme).toBe('system');
  
  // Trigger action
  fireEvent.click(getByRole('button'));
  
  // Assert state change
  expect(useUIStore.getState().theme).toBe('light');
});
```

## Migration from Context/Redux

### From Context API
```typescript
// ❌ Old Context pattern
const { user, setUser } = useContext(UserContext);

// ✅ New Zustand pattern
const user = useUser();
const { updateUser } = useAppActions();
```

### From Redux
```typescript
// ❌ Old Redux pattern
const dispatch = useDispatch();
const theme = useSelector(state => state.ui.theme);
dispatch(setTheme('dark'));

// ✅ New Zustand pattern
const theme = useTheme();
const setTheme = useSetTheme();
setTheme('dark');
```

## Debugging

1. **Redux DevTools**: Zustand integrates automatically
2. **State Inspection**: `useUIStore.getState()` in console
3. **Store Actions**: All actions are logged in development
4. **React DevTools**: Components show Zustand hook usage

## Available Hooks

### App Store Hooks
```typescript
import { 
  useAppStore, useUser, usePreferences, useNotifications, 
  useSidebar, useAppLoading, useAppError, useAppActions, useAddNotification 
} from '@/store';
```

### Auth Store Hooks  
```typescript
import { 
  useAuthStore, useAuth, useAuthActions, useIsSignedIn, 
  useAuthUser, useAuthUserId, useAuthLoading 
} from '@/store';
```

### UI Store Hooks
```typescript
import { 
  useUIStore, useTheme, useSidebarState, useModals, useToasts, 
  useLoading, useScreenSize, useUIActions, useSidebarOpen, useIsMobile, 
  useSetTheme, useToggleSidebar, useShowToast, useSidebarCollapsed 
} from '@/store';
```

### Locale Store Hooks
```typescript
import { 
  useLocaleStore, useLocale, useDefaultLocale, useAvailableLocales, 
  useIsRTL, useLocaleState, useSetLocale, useLocaleActions 
} from '@/store';
```

### Utility Hooks
```typescript
import { useStoreInitialization, useStoreReset } from '@/store';
```

## References

- [State Management Documentation](/docs/04-architecture/state-management.md)
- [Zustand GitHub](https://github.com/pmndrs/zustand)
- [Example Component](/src/components/StateManagement/Zustand.tsx)
- [Store Files](/src/store/)