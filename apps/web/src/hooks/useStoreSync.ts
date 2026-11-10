"use client";

import { useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useAppStore, useAuthStore, useUIStore } from '@/store';

/**
 * Hook to sync external state with stores
 */
export function useStoreSync() {
  const { user, isLoaded } = useUser();
  const { sessionId } = useAuth();
  const { setUser: setAppUser } = useAppStore();
  const { setAuth, clearAuth, setLoading } = useAuthStore();

  // Sync Clerk user with stores
  useEffect(() => {
    if (!isLoaded) {
      setLoading(true);
      return;
    }

    if (user) {
      const userData = {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress || '',
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
      };

      // Update app store user
      setAppUser(userData);

      // Update auth store
      setAuth({
        isSignedIn: true,
        userId: user.id,
        user: {
          ...userData,
          createdAt: user.createdAt || new Date(),
          lastSignInAt: user.lastSignInAt,
        },
        session: sessionId ? {
          id: sessionId,
          status: 'active' as const,
          expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Default 24 hours
          lastActiveAt: new Date(),
        } : null,
      });
    } else {
      setAppUser(null);
      clearAuth();
    }
  }, [user, isLoaded, sessionId, setAppUser, setAuth, clearAuth, setLoading]);
}

/**
 * Hook to sync theme with CSS variables and localStorage
 */
export function useThemeSync() {
  const theme = useUIStore((state) => state.theme);

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove previous theme classes
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(mediaQuery.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);
}

/**
 * Hook to sync sidebar state with CSS classes
 */
export function useSidebarSync() {
  const { open, collapsed } = useUIStore((state) => ({
    open: state.sidebarOpen,
    collapsed: state.sidebarCollapsed,
  }));

  useEffect(() => {
    const body = document.body;
    
    if (open) {
      body.classList.add('sidebar-open');
    } else {
      body.classList.remove('sidebar-open');
    }

    if (collapsed) {
      body.classList.add('sidebar-collapsed');
    } else {
      body.classList.remove('sidebar-collapsed');
    }

    return () => {
      body.classList.remove('sidebar-open', 'sidebar-collapsed');
    };
  }, [open, collapsed]);
}

/**
 * Hook to sync screen size with store
 */
export function useScreenSizeSync() {
  const setScreenSize = useUIStore((state) => state.setScreenSize);

  useEffect(() => {
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
  }, [setScreenSize]);
}

/**
 * Master hook that syncs all external state
 */
export function useMasterSync() {
  useStoreSync();
  useThemeSync();
  useSidebarSync();
  useScreenSizeSync();
}