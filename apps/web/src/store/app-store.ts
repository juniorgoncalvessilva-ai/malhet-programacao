import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useMemo } from 'react';
import { AppStore, AppPreferences, User, Notification } from './types';

// Default preferences
const defaultPreferences: AppPreferences = {
  theme: 'system',
  language: 'pt',
  notifications: {
    email: true,
    push: true,
    marketing: false,
  },
  sidebar: {
    collapsed: false,
    pinned: true,
  },
};

// Initial state
const initialState = {
  isInitialized: false,
  isLoading: false,
  error: null,
  user: null,
  preferences: defaultPreferences,
  notifications: [],
  sidebar: {
    isOpen: false,
    isMobile: false,
  },
};

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Initialization
        initializeApp: async () => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            // Initialize app logic here
            // Could load user preferences, check authentication, etc.
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate async work

            set((state) => {
              state.isInitialized = true;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.isLoading = false;
              state.error = error instanceof Error ? error.message : 'Failed to initialize app';
            });
          }
        },

        setLoading: (loading: boolean) => {
          set((state) => {
            state.isLoading = loading;
          });
        },

        setError: (error: string | null) => {
          set((state) => {
            state.error = error;
          });
        },

        // User management
        setUser: (user: User | null) => {
          set((state) => {
            state.user = user;
          });
        },

        updateUser: (updates: Partial<User>) => {
          set((state) => {
            if (state.user) {
              Object.assign(state.user, updates);
            }
          });
        },

        // Preferences management
        updatePreferences: (updates: Partial<AppPreferences>) => {
          set((state) => {
            state.preferences = { ...state.preferences, ...updates };
          });
        },

        resetPreferences: () => {
          set((state) => {
            state.preferences = defaultPreferences;
          });
        },

        // Notifications management
        addNotification: (notification) => {
          const newNotification: Notification = {
            ...notification,
            id: crypto.randomUUID(),
            timestamp: new Date(),
            read: false,
          };

          set((state) => {
            state.notifications.unshift(newNotification);
            // Keep only last 50 notifications
            if (state.notifications.length > 50) {
              state.notifications.splice(50);
            }
          });

          // Auto-remove success notifications after 5 seconds
          if (notification.type === 'success') {
            setTimeout(() => {
              get().removeNotification(newNotification.id);
            }, 5000);
          }
        },

        markNotificationAsRead: (id: string) => {
          set((state) => {
            const notification = state.notifications.find(n => n.id === id);
            if (notification) {
              notification.read = true;
            }
          });
        },

        removeNotification: (id: string) => {
          set((state) => {
            state.notifications = state.notifications.filter(n => n.id !== id);
          });
        },

        clearAllNotifications: () => {
          set((state) => {
            state.notifications = [];
          });
        },

        // Sidebar management
        toggleSidebar: () => {
          set((state) => {
            state.sidebar.isOpen = !state.sidebar.isOpen;
          });
        },

        setSidebarOpen: (open: boolean) => {
          set((state) => {
            state.sidebar.isOpen = open;
          });
        },

        setSidebarMobile: (mobile: boolean) => {
          set((state) => {
            state.sidebar.isMobile = mobile;
          });
        },
      })),
      {
        name: 'app-store',
        partialize: (state) => ({
          preferences: state.preferences,
          // Don't persist sensitive data like user info or notifications
        }),
      }
    ),
    {
      name: 'app-store',
    }
  )
);

// Selectors for common data
export const useUser = () => useAppStore((state) => state.user);
export const usePreferences = () => useAppStore((state) => state.preferences);
export const useNotifications = () => useAppStore((state) => state.notifications);
export const useSidebar = () => useAppStore((state) => state.sidebar);
export const useAppLoading = () => useAppStore((state) => state.isLoading);
export const useAppError = () => useAppStore((state) => state.error);

// Action selectors
// Individual action selectors
export const useAddNotification = () => useAppStore((state) => state.addNotification);
export const useClearAllNotifications = () => useAppStore((state) => state.clearAllNotifications);
export const useUpdatePreferences = () => useAppStore((state) => state.updatePreferences);

// For backward compatibility, provide a hook that uses memoized object
export const useAppActions = () => {
  const addNotification = useAppStore((state) => state.addNotification);
  const clearAllNotifications = useAppStore((state) => state.clearAllNotifications);
  const updatePreferences = useAppStore((state) => state.updatePreferences);
  const setUser = useAppStore((state) => state.setUser);
  const updateUser = useAppStore((state) => state.updateUser);
  
  return useMemo(() => ({
    addNotification,
    clearAllNotifications,
    updatePreferences,
    setUser,
    updateUser,
  }), [addNotification, clearAllNotifications, updatePreferences, setUser, updateUser]);
};