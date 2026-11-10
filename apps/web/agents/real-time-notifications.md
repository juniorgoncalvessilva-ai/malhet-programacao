# 🔔 Real-time Notifications Implementation Guide

## Context
You are implementing real-time notifications for the AI Coders Starter Kit. This system uses **TanStack Query** for server state management, **Supabase** for data persistence and real-time subscriptions, and **Zustand** for client state, following the established modern architecture patterns.

## Key Requirements

### ✅ Must Follow
- **TanStack Query for Server State**: Cache management, optimistic updates, background sync
- **Supabase for Real-time Data**: Persistent notification storage with live subscriptions
- **Zustand for Client State**: UI preferences, toasts, temporary states
- **API Layer Separation**: Dedicated API functions, queries, and mutations
- **Individual Selectors**: Avoid object selectors that cause infinite loops
- **Proper Error Handling**: User-friendly error states with retry functionality
- **Loading States**: Granular loading indicators for each operation
- **TypeScript**: Full type safety with proper interfaces

### ❌ Critical Mistakes to Avoid
- **Direct Supabase Calls**: Always use TanStack Query API layer instead
- **Object Selectors in Zustand**: `useStore(state => ({ a: state.a, b: state.b }))` causes infinite loops
- **Bypassing TanStack Query**: Don't call Supabase directly from components
- **Manual Cache Management**: Let TanStack Query handle cache invalidation
- **Missing Cleanup**: Always cleanup subscriptions in useEffect cleanup
- **Inconsistent Loading States**: Use TanStack Query's built-in loading states

## Implementation Patterns

### 1. API Layer Structure

```typescript
// ✅ CORRECT: Separate API functions in /hooks/api/notifications.ts
import { useClerkSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

export type Notification = Database['public']['Tables']['notifications']['Row']
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert']

export const notificationsApi = {
  async getNotifications(userId: string): Promise<Notification[]> {
    const supabase = useClerkSupabaseClient()
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) throw error
    return data || []
  },
  
  async createNotification(notification: NotificationInsert): Promise<Notification> {
    const supabase = useClerkSupabaseClient()
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single()
    
    if (error) throw error
    return data
  },
  
  // More CRUD operations...
}
```

### 2. TanStack Query Hook Structure

```typescript
// ✅ CORRECT: Query hook in /hooks/queries/useNotifications.ts
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
import { useEffect } from 'react'
import { notificationsApi } from '../api/notifications'

export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (userId: string) => [...notificationKeys.lists(), userId] as const,
}

export function useNotificationsQuery() {
  const { user } = useUser()
  const queryClient = useQueryClient()

  // TanStack Query handles caching, loading, error states
  const query = useQuery({
    queryKey: notificationKeys.list(user?.id || ''),
    queryFn: () => notificationsApi.getNotifications(user!.id),
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  // Real-time subscription integrated with TanStack Query cache
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const queryKey = notificationKeys.list(user.id)
        
        // Update TanStack Query cache directly
        if (payload.eventType === 'INSERT') {
          queryClient.setQueryData(queryKey, (old: Notification[] = []) => [
            payload.new as Notification,
            ...old.slice(0, 49)
          ])
        }
        // Handle UPDATE and DELETE similarly...
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.id, queryClient])

  return query
}
```

### 3. Mutation Pattern

```typescript
// ✅ CORRECT: Mutation hook in /hooks/mutations/useNotificationMutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
import { useShowToast } from '@/store'
import { notificationsApi } from '../api/notifications'
import { notificationKeys } from '../queries/useNotifications'

export function useMarkNotificationAsRead() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const showToast = useShowToast()

  return useMutation({
    mutationFn: (notificationId: string) => 
      notificationsApi.markAsRead(notificationId),
    
    onMutate: async (notificationId) => {
      // Optimistic update
      const queryKey = notificationKeys.list(user?.id || '')
      await queryClient.cancelQueries({ queryKey })
      
      const previousNotifications = queryClient.getQueryData(queryKey)
      
      queryClient.setQueryData(queryKey, (old: Notification[] = []) =>
        old.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
      
      return { previousNotifications }
    },
    
    onError: (error, notificationId, context) => {
      // Automatic rollback on error
      if (context?.previousNotifications && user?.id) {
        queryClient.setQueryData(
          notificationKeys.list(user.id),
          context.previousNotifications
        )
      }
      
      showToast({
        type: 'error',
        title: 'Failed to mark as read',
        message: error.message,
      })
    },
  })
}
```

### 3. Dual Notification Strategy

```typescript
const handleNewNotification = useCallback((notification) => {
  // 1. Show immediate toast feedback (ephemeral)
  showToast({
    type: notification.type,
    title: notification.title,
    message: notification.message,
    duration: 5000,
  })
  
  // 2. Add to Zustand for persistent UI state
  addNotification({
    type: notification.type,
    title: notification.title,
    message: notification.message,
  })
}, [showToast, addNotification])
```

### 4. Component Implementation

```typescript
export function NotificationDropdown() {
  const {
    notifications,
    recentNotifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useRealtimeNotifications()

  // Loading state
  if (loading) {
    return <NotificationLoading message="Loading notifications..." />
  }

  // Error state with retry
  if (error) {
    return (
      <ErrorState
        title="Failed to load notifications"
        message={error}
        onRetry={() => window.location.reload()}
      />
    )
  }

  // Empty state
  if (notifications.length === 0) {
    return (
      <EmptyState
        title="No notifications"
        description="You're all caught up!"
      />
    )
  }

  return (
    <div>
      {/* Enhanced UI implementation */}
    </div>
  )
}
```

## Database Schema Requirements

### Table Structure
```sql
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Optional metadata
  action_url TEXT,
  icon TEXT,
  sender_id TEXT,
  sender_name TEXT,
  sender_avatar TEXT
);
```

### Required Indexes
```sql
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

### RLS Policies
```sql
-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

## State Management Integration

### Store Structure
```typescript
// App Store - for persistent notifications
interface AppStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;
  // ...
}

// UI Store - for ephemeral toasts
interface UIStore {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  // ...
}
```

### Hook Exports Pattern
```typescript
// Individual selector exports (prevents infinite loops)
export const useNotifications = () => useAppStore(state => state.notifications)
export const useAddNotification = () => useAppStore(state => state.addNotification)
export const useShowToast = () => useUIStore(state => state.showToast)
```

## Performance Optimizations

### 1. Selective Updates
```typescript
// ✅ GOOD: Optimistic updates
const markAsRead = useCallback(async (notificationId: string) => {
  // Immediate UI update
  setSupabaseNotifications(prev =>
    prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
  )
  
  // Then sync with server
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      
    if (error) throw error
  } catch (err) {
    // Revert optimistic update on error
    setSupabaseNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: false } : n)
    )
    showToast({ type: 'error', message: 'Failed to mark as read' })
  }
}, [supabase, showToast])
```

### 2. Notification Limits
```typescript
// Limit notifications to prevent memory issues
const { data, error } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(50) // ✅ IMPORTANT: Always limit results
```

### 3. Smart Pagination
```typescript
// Get recent notifications first
const recentNotifications = supabaseNotifications.slice(0, 10)
```

## Error Handling Patterns

### 1. User-Friendly Errors
```typescript
const handleError = useCallback((error: string, operation: string) => {
  console.error(`Notification ${operation} error:`, error)
  
  showToast({
    type: 'error',
    title: 'Notification Error',
    message: `Failed to ${operation}`,
    duration: 4000,
  })
}, [showToast])
```

### 2. Retry Mechanisms
```typescript
const [retryCount, setRetryCount] = useState(0)
const maxRetries = 3

const fetchWithRetry = useCallback(async () => {
  try {
    await fetchNotifications()
    setRetryCount(0) // Reset on success
  } catch (error) {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1)
      setTimeout(fetchWithRetry, 1000 * Math.pow(2, retryCount)) // Exponential backoff
    } else {
      handleError(error.message, 'fetch notifications')
    }
  }
}, [retryCount, maxRetries])
```

## UI/UX Patterns

### 1. Loading States
```typescript
// Use dedicated loading components
import { NotificationLoading, ErrorState, EmptyState } from '@/components/ui/loading-states'

{loading && <NotificationLoading />}
{error && <ErrorState title="Error" message={error} onRetry={retry} />}
{notifications.length === 0 && <EmptyState title="No notifications" />}
```

### 2. Animation Patterns
```typescript
// Animate new notifications
const [hasNewNotifications, setHasNewNotifications] = useState(false)

useEffect(() => {
  if (unreadCount > previousUnreadCount && previousUnreadCount > 0) {
    setHasNewNotifications(true)
    const timer = setTimeout(() => setHasNewNotifications(false), 2000)
    return () => clearTimeout(timer)
  }
  setPreviousUnreadCount(unreadCount)
}, [unreadCount, previousUnreadCount])

// Apply animation classes
<BellIcon className={cn(
  "transition-all duration-200",
  hasNewNotifications && "animate-pulse text-primary"
)} />
```

### 3. Badge Display
```typescript
// Smart badge with count
{unreadCount > 0 && (
  <span className={cn(
    "absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs px-1 min-w-[18px] h-[18px] flex items-center justify-center",
    hasNewNotifications && "animate-bounce"
  )}>
    {unreadCount > 99 ? '99+' : unreadCount}
  </span>
)}
```

## Testing Requirements

### 1. Component Testing
```typescript
describe('Real-time Notifications', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({ notifications: [] })
  })

  it('should display unread count correctly', () => {
    const { result } = renderHook(() => useRealtimeNotifications())
    
    act(() => {
      result.current.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      })
    })
    
    expect(result.current.unreadCount).toBe(1)
  })
})
```

### 2. Real-time Testing
```typescript
it('should handle real-time updates', async () => {
  const { result } = renderHook(() => useRealtimeNotifications())
  
  // Simulate real-time notification
  act(() => {
    mockSupabaseChannel.trigger('postgres_changes', {
      eventType: 'INSERT',
      new: mockNotification,
    })
  })
  
  await waitFor(() => {
    expect(result.current.notifications).toHaveLength(1)
  })
})
```

## Common Pitfalls

### 1. Infinite Loop Prevention
```typescript
// ❌ CAUSES INFINITE LOOPS
const { notifications, addNotification } = useAppStore(state => ({
  notifications: state.notifications,
  addNotification: state.addNotification,
}))

// ✅ CORRECT APPROACH
const notifications = useNotifications()
const addNotification = useAddNotification()
```

### 2. Memory Leaks Prevention
```typescript
// ✅ ALWAYS cleanup subscriptions
useEffect(() => {
  const channel = supabase.channel('notifications')
  // ... setup
  
  return () => {
    supabase.removeChannel(channel) // CRITICAL
  }
}, [])
```

### 3. Proper Error Boundaries
```typescript
// ✅ Handle subscription errors
.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    console.log('✅ Notification subscription active')
  } else if (status === 'CHANNEL_ERROR') {
    handleError('Real-time subscription failed', 'connect')
  }
})
```

## File Structure

### New TanStack Query Architecture

```
src/hooks/
├── api/
│   └── notifications.ts              # ✅ Pure API functions (Supabase calls)
├── queries/
│   └── useNotifications.ts           # ✅ TanStack Query hooks (main hook)
├── mutations/
│   └── useNotificationMutations.ts   # ✅ Mutations with optimistic updates
├── useNotificationCreator.ts         # ✅ Helper for creating notifications
└── useRealtimeNotifications.ts       # ⚠️ Legacy compatibility

src/components/
├── Layouts/header/notification/
│   └── index.tsx                     # ✅ Updated UI component
├── ui/
│   └── loading-states.tsx            # ✅ Loading components
└── test/
    └── NotificationTester.tsx        # ✅ Test component

src/store/
├── app-store.ts                      # ✅ Client state only (no server data)
└── ui-store.ts                       # ✅ Toasts and UI state
```

### Architecture Benefits

1. **Separation of Concerns**
   - API layer: Pure functions, easily testable
   - Queries: Read operations with caching
   - Mutations: Write operations with optimistic updates
   - Components: Presentation logic only

2. **Improved Developer Experience**
   - Better TypeScript inference
   - Granular loading states
   - Automatic error handling
   - DevTools integration

3. **Performance Optimizations**
   - Intelligent caching with TanStack Query
   - Selective re-renders
   - Background updates
   - Memory leak prevention

4. **Maintainability**
   - Consistent patterns across the codebase
   - Clear data flow
   - Easier testing and debugging

## Migration Guide

### From Old Implementation to TanStack Query

```typescript
// ❌ OLD: Direct Supabase calls with useState
const [notifications, setNotifications] = useState([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
    setNotifications(data)
    setLoading(false)
  }
  fetchNotifications()
}, [])

// ✅ NEW: TanStack Query with caching and real-time
const {
  notifications,
  isLoading,
  isFetching,
  markAsRead,
} = useNotificationsQuery()
```

### Component Migration

```typescript
// ❌ OLD: Manual state management
export function NotificationDropdown() {
  const {
    notifications,
    loading,
    markAsRead,
  } = useRealtimeNotifications() // Old hook
  
  const handleMarkAsRead = async (id) => {
    // Manual optimistic update + error handling
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ))
    
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
    } catch (error) {
      // Manual rollback
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, read: false } : n
      ))
    }
  }
}

// ✅ NEW: TanStack Query automatic optimistic updates
export function NotificationDropdown() {
  const {
    notifications,
    isLoading,
    isFetching,
    markAsRead,
    isMarkingAsRead,
  } = useNotificationsQuery() // New hook
  
  // Single call - TanStack Query handles optimistic updates + rollback
  const handleMarkAsRead = (id) => markAsRead(id)
}
```

## Integration Examples

### E-commerce Order Notifications
```typescript
const { createNotification } = useNotificationSync()

const handleOrderComplete = async (order) => {
  await createNotification({
    title: 'Order Confirmed!',
    message: `Your order #${order.id} has been confirmed`,
    type: 'success',
    action_url: `/orders/${order.id}`,
    sender_name: 'Store System',
  })
}
```

### Chat Message Notifications
```typescript
const handleNewMessage = (message) => {
  if (message.sender_id !== currentUser.id) {
    createNotification({
      title: `New message from ${message.sender_name}`,
      message: message.content,
      type: 'info',
      sender_id: message.sender_id,
      sender_name: message.sender_name,
      sender_avatar: message.sender_avatar,
    })
  }
}
```

## Deployment Considerations

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Database Migrations
Always run migrations to create the notifications table and set up RLS policies before deploying.

### Real-time Configuration
Ensure Supabase real-time is enabled and the notifications table is added to the publication.

## Success Metrics

- [ ] No infinite render loops in production
- [ ] Real-time updates work across browser tabs
- [ ] Proper error handling with user feedback
- [ ] Smooth animations and loading states
- [ ] TypeScript compliance with no any types
- [ ] Comprehensive test coverage
- [ ] Performance optimized (< 100ms response time)
- [ ] Memory efficient (no memory leaks)

This guide ensures you implement notifications following all established patterns while avoiding common pitfalls.