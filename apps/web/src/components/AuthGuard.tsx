"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "@/i18n/navigation";
import { useEffect } from "react";

// Dev sem Clerk (NEXT_PUBLIC_AUTH_DISABLED=true): não bloqueia as páginas.
const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authDisabled && isLoaded && !isSignedIn) {
      router.push("/auth/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  if (authDisabled) return <>{children}</>;

  // Show loading state while auth is being checked
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // Don't render children if not signed in
  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return <>{children}</>;
}