// Export all stores and their hooks
export { useAppStore, useUser, usePreferences, useNotifications, useSidebar, useAppLoading, useAppError, useAppActions, useAddNotification } from './app-store';
export { useAuthStore, useAuth, useAuthActions, useIsSignedIn, useAuthUser, useAuthUserId, useAuthLoading } from './auth-store';
export { useUIStore, useTheme, useSidebarState, useModals, useToasts, useLoading, useScreenSize, useUIActions, useSidebarOpen, useIsMobile, useSetTheme, useToggleSidebar, useShowToast, useSidebarCollapsed } from './ui-store';
export { useLocaleStore, useLocale, useDefaultLocale, useAvailableLocales, useIsRTL, useLocaleState, useSetLocale, useLocaleActions } from './locale-store';

// Export types
export type { AppStore, User, Notification, AppPreferences, AppState, AppActions } from './types';

// Store initialization hook
import { useEffect } from 'react';
import { useAppStore } from './app-store';
import { useUIStore } from './ui-store';
import { useLocaleStore } from './locale-store';

export function useStoreInitialization() {
  const initializeApp = useAppStore((state) => state.initializeApp);
  const setScreenSize = useUIStore((state) => state.setScreenSize);
  const setAvailableLocales = useLocaleStore((state) => state.setAvailableLocales);

  useEffect(() => {
    // Initialize app store
    initializeApp();

    // Initialize locale store with available locales
    setAvailableLocales(['pt-BR', 'en']);

    // Set initial screen size
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setScreenSize('mobile');
      } else if (width < 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);

    return () => window.removeEventListener('resize', updateScreenSize);
  }, [initializeApp, setScreenSize, setAvailableLocales]);
}

// Store reset utility
export function useStoreReset() {
  const resetPreferences = useAppStore((state) => state.resetPreferences);
  const clearAllNotifications = useAppStore((state) => state.clearAllNotifications);
  const closeAllModals = useUIStore((state) => state.closeAllModals);
  const clearAllToasts = useUIStore((state) => state.clearAllToasts);

  return () => {
    resetPreferences();
    clearAllNotifications();
    closeAllModals();
    clearAllToasts();
  };
}