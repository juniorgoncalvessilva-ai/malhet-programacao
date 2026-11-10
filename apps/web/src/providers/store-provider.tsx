"use client";

import { useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useAuthStore } from '@/store/auth-store';
import { useStoreInitialization } from '@/store';

interface StoreProviderProps {
  children: React.ReactNode;
}

export function StoreProvider({ children }: StoreProviderProps) {
  const { user, isLoaded } = useUser();
  const { sessionId } = useAuth();
  const { setAuth, clearAuth, setLoading } = useAuthStore();
  
  // Initialize stores
  useStoreInitialization();

  // Sync Clerk auth state with auth store
  useEffect(() => {
    if (!isLoaded) {
      setLoading(true);
      return;
    }

    if (user) {
      setAuth({
        isSignedIn: true,
        userId: user.id,
        user: {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress || '',
          fullName: user.fullName,
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
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
      clearAuth();
    }
  }, [user, isLoaded, sessionId, setAuth, clearAuth, setLoading]);

  return <>{children}</>;
}