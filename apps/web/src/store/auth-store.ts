import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useMemo } from 'react';

interface AuthState {
  isLoading: boolean;
  isSignedIn: boolean;
  userId: string | null;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    createdAt: Date;
    lastSignInAt: Date | null;
  } | null;
  session: {
    id: string;
    status: 'active' | 'expired' | 'removed';
    expireAt: Date;
    lastActiveAt: Date;
  } | null;
}

interface AuthActions {
  setAuth: (data: {
    isSignedIn: boolean;
    userId: string | null;
    user: AuthState['user'];
    session: AuthState['session'];
  }) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
  updateUser: (updates: Partial<NonNullable<AuthState['user']>>) => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  isLoading: true,
  isSignedIn: false,
  userId: null,
  user: null,
  session: null,
};

export const useAuthStore = create<AuthStore>()(
  devtools(
    immer((set) => ({
      ...initialState,

      setAuth: (data) => {
        set((state) => {
          state.isLoading = false;
          state.isSignedIn = data.isSignedIn;
          state.userId = data.userId;
          state.user = data.user;
          state.session = data.session;
        });
      },

      setLoading: (loading) => {
        set((state) => {
          state.isLoading = loading;
        });
      },

      clearAuth: () => {
        set((state) => {
          state.isLoading = false;
          state.isSignedIn = false;
          state.userId = null;
          state.user = null;
          state.session = null;
        });
      },

      updateUser: (updates) => {
        set((state) => {
          if (state.user) {
            Object.assign(state.user, updates);
          }
        });
      },
    })),
    {
      name: 'auth-store',
    }
  )
);

// Selectors (individual to avoid object creation)
export const useIsSignedIn = () => useAuthStore((state) => state.isSignedIn);
export const useAuthUserId = () => useAuthStore((state) => state.userId);
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);

// For backward compatibility, provide a memoized hook
export const useAuth = () => {
  const isLoading = useAuthStore((state) => state.isLoading);
  const isSignedIn = useAuthStore((state) => state.isSignedIn);
  const userId = useAuthStore((state) => state.userId);
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  
  return useMemo(() => ({
    isLoading,
    isSignedIn,
    userId,
    user,
    session,
  }), [isLoading, isSignedIn, userId, user, session]);
};

// Individual action selectors
export const useSetAuth = () => useAuthStore((state) => state.setAuth);
export const useClearAuth = () => useAuthStore((state) => state.clearAuth);

// For backward compatibility, provide a hook that uses memoized object
export const useAuthActions = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const updateUser = useAuthStore((state) => state.updateUser);
  
  return useMemo(() => ({
    setAuth,
    clearAuth,
    updateUser,
  }), [setAuth, clearAuth, updateUser]);
};