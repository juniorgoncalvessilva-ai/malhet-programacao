import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useMemo } from 'react';
import { toast } from 'sonner';

interface Modal {
  id: string;
  component: string;
  props?: Record<string, any>;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  sidebarPinned: boolean;
  
  // Navigation
  currentPage: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  
  // Modals
  modals: Modal[];
  
  // Toasts
  toasts: Toast[];
  
  // Loading states
  globalLoading: boolean;
  loadingStates: Record<string, boolean>;
  
  // Screen size
  screenSize: 'mobile' | 'tablet' | 'desktop';
  isMobile: boolean;
}

interface UIActions {
  // Theme
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  // Sidebar
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarPinned: (pinned: boolean) => void;
  
  // Navigation
  setCurrentPage: (page: string) => void;
  setBreadcrumb: (breadcrumb: Array<{ label: string; href?: string }>) => void;
  
  // Modals
  openModal: (modal: Omit<Modal, 'id'>) => string;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  
  // Toasts
  showToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  
  // Loading
  setGlobalLoading: (loading: boolean) => void;
  setLoading: (key: string, loading: boolean) => void;
  clearLoadingState: (key: string) => void;
  
  // Screen size
  setScreenSize: (size: 'mobile' | 'tablet' | 'desktop') => void;
}

type UIStore = UIState & UIActions;

const initialState: UIState = {
  theme: 'system',
  sidebarOpen: true,
  sidebarCollapsed: false,
  sidebarPinned: true,
  currentPage: '',
  breadcrumb: [],
  modals: [],
  toasts: [],
  globalLoading: false,
  loadingStates: {},
  screenSize: 'desktop',
  isMobile: false,
};

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Theme
        setTheme: (theme) => {
          set((state) => {
            state.theme = theme;
          });
          
          // Sync with next-themes for DOM class management
          if (typeof window !== 'undefined') {
            const nextThemesSetTheme = (window as any).__NEXT_THEMES__?.setTheme;
            if (nextThemesSetTheme) {
              nextThemesSetTheme(theme);
            } else {
              // Fallback: manually set document class
              document.documentElement.classList.toggle('dark', theme === 'dark');
            }
          }
        },

        // Sidebar
        toggleSidebar: () => {
          set((state) => {
            state.sidebarOpen = !state.sidebarOpen;
          });
        },

        setSidebarOpen: (open) => {
          set((state) => {
            state.sidebarOpen = open;
          });
        },

        toggleSidebarCollapsed: () => {
          set((state) => {
            state.sidebarCollapsed = !state.sidebarCollapsed;
          });
        },

        setSidebarCollapsed: (collapsed) => {
          set((state) => {
            state.sidebarCollapsed = collapsed;
          });
        },

        setSidebarPinned: (pinned) => {
          set((state) => {
            state.sidebarPinned = pinned;
          });
        },

        // Navigation
        setCurrentPage: (page) => {
          set((state) => {
            state.currentPage = page;
          });
        },

        setBreadcrumb: (breadcrumb) => {
          set((state) => {
            state.breadcrumb = breadcrumb;
          });
        },

        // Modals
        openModal: (modal) => {
          const id = crypto.randomUUID();
          const newModal: Modal = {
            ...modal,
            id,
            size: modal.size || 'md',
            closable: modal.closable !== false,
          };

          set((state) => {
            state.modals.push(newModal);
          });

          return id;
        },

        closeModal: (id) => {
          set((state) => {
            state.modals = state.modals.filter(modal => modal.id !== id);
          });
        },

        closeAllModals: () => {
          set((state) => {
            state.modals = [];
          });
        },

        // Toasts
        showToast: (toastData) => {
          const id = crypto.randomUUID();
          const newToast: Toast = {
            ...toastData,
            id,
            duration: toastData.duration || (toastData.type === 'error' ? 6000 : 4000),
          };

          // Show with Sonner
          const sonnerOptions = {
            duration: newToast.duration,
            action: newToast.action ? {
              label: newToast.action.label,
              onClick: newToast.action.onClick,
            } : undefined,
          };

          switch (newToast.type) {
            case 'success':
              toast.success(newToast.title || newToast.message, newToast.title ? { description: newToast.message, ...sonnerOptions } : sonnerOptions);
              break;
            case 'error':
              toast.error(newToast.title || newToast.message, newToast.title ? { description: newToast.message, ...sonnerOptions } : sonnerOptions);
              break;
            case 'warning':
              toast.warning(newToast.title || newToast.message, newToast.title ? { description: newToast.message, ...sonnerOptions } : sonnerOptions);
              break;
            case 'info':
            default:
              toast(newToast.title || newToast.message, newToast.title ? { description: newToast.message, ...sonnerOptions } : sonnerOptions);
              break;
          }

          // Store in Zustand state for tracking
          set((state) => {
            state.toasts.push(newToast);
            // Keep only last 5 toasts
            if (state.toasts.length > 5) {
              state.toasts.splice(0, state.toasts.length - 5);
            }
          });

          // Auto-remove from store after duration
          if (newToast.duration && newToast.duration > 0) {
            setTimeout(() => {
              get().removeToast(id);
            }, newToast.duration);
          }

          return id;
        },

        removeToast: (id) => {
          set((state) => {
            state.toasts = state.toasts.filter(toast => toast.id !== id);
          });
        },

        clearAllToasts: () => {
          set((state) => {
            state.toasts = [];
          });
        },

        // Loading
        setGlobalLoading: (loading) => {
          set((state) => {
            state.globalLoading = loading;
          });
        },

        setLoading: (key, loading) => {
          set((state) => {
            if (loading) {
              state.loadingStates[key] = true;
            } else {
              delete state.loadingStates[key];
            }
          });
        },

        clearLoadingState: (key) => {
          set((state) => {
            delete state.loadingStates[key];
          });
        },

        // Screen size
        setScreenSize: (size) => {
          set((state) => {
            state.screenSize = size;
            state.isMobile = size === 'mobile';
            
            // Auto-adjust sidebar based on screen size
            if (size === 'mobile') {
              state.sidebarOpen = false;
              state.sidebarPinned = false;
            } else if (size === 'desktop') {
              state.sidebarPinned = true;
            }
          });
        },
      })),
      {
        name: 'ui-store',
        partialize: (state) => ({
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
          sidebarPinned: state.sidebarPinned,
        }),
      }
    ),
    {
      name: 'ui-store',
    }
  )
);

// Selectors
export const useTheme = () => useUIStore((state) => state.theme);
// Individual sidebar selectors
export const useSidebarOpen = () => useUIStore((state) => state.sidebarOpen);
export const useSidebarCollapsed = () => useUIStore((state) => state.sidebarCollapsed);
export const useSidebarPinned = () => useUIStore((state) => state.sidebarPinned);

// Memoized sidebar state for backward compatibility
export const useSidebarState = () => {
  const open = useUIStore((state) => state.sidebarOpen);
  const collapsed = useUIStore((state) => state.sidebarCollapsed);
  const pinned = useUIStore((state) => state.sidebarPinned);
  
  return useMemo(() => ({
    open,
    collapsed,
    pinned,
  }), [open, collapsed, pinned]);
};

export const useModals = () => useUIStore((state) => state.modals);
export const useToasts = () => useUIStore((state) => state.toasts);
export const useLoading = (key?: string) => useUIStore((state) => 
  key ? state.loadingStates[key] || false : state.globalLoading
);

// Individual screen size selectors
export const useScreenSizeValue = () => useUIStore((state) => state.screenSize);
export const useIsMobile = () => useUIStore((state) => state.isMobile);

// Memoized screen size for backward compatibility
export const useScreenSize = () => {
  const size = useUIStore((state) => state.screenSize);
  const isMobile = useUIStore((state) => state.isMobile);
  
  return useMemo(() => ({
    size,
    isMobile,
  }), [size, isMobile]);
};

// Individual action selectors to avoid object creation
export const useSetTheme = () => useUIStore((state) => state.setTheme);
export const useToggleSidebar = () => useUIStore((state) => state.toggleSidebar);
export const useShowToast = () => useUIStore((state) => state.showToast);
export const useOpenModal = () => useUIStore((state) => state.openModal);
export const useCloseModal = () => useUIStore((state) => state.closeModal);
export const useSetLoading = () => useUIStore((state) => state.setLoading);

// For backward compatibility, provide a hook that uses memoized object
export const useUIActions = () => {
  const setTheme = useUIStore((state) => state.setTheme);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);
  const toggleSidebarCollapsed = useUIStore((state) => state.toggleSidebarCollapsed);
  const setSidebarCollapsed = useUIStore((state) => state.setSidebarCollapsed);
  const showToast = useUIStore((state) => state.showToast);
  const openModal = useUIStore((state) => state.openModal);
  const closeModal = useUIStore((state) => state.closeModal);
  const setLoading = useUIStore((state) => state.setLoading);
  
  return useMemo(() => ({
    setTheme,
    toggleSidebar,
    setSidebarOpen,
    toggleSidebarCollapsed,
    setSidebarCollapsed,
    showToast,
    openModal,
    closeModal,
    setLoading,
  }), [setTheme, toggleSidebar, setSidebarOpen, toggleSidebarCollapsed, setSidebarCollapsed, showToast, openModal, closeModal, setLoading]);
};