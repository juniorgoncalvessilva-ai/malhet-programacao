"use client";

import { usePathname } from "@/i18n/navigation";
import type { PropsWithChildren } from "react";

export function ConditionalLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  
  // Check if current path is an auth page (considering locale prefix)
  const isAuthPage = pathname?.includes("/auth/");
  
  // Check if current path is the landing page (root)
  const isLandingPage = pathname === "/" || pathname?.match(/^\/[a-z]{2}(-[A-Z]{2})?$/);
  
  // Check if current path is an app page
  const isAppPage = pathname?.includes("/app/");

  if (isAuthPage) {
    // Simple layout for authentication pages
    return (
      <div className="min-h-screen bg-gray-2 dark:bg-[#020d1a]">
        <main className="isolate mx-auto w-full max-w-screen-2xl overflow-hidden p-4 md:p-6 2xl:p-10">
          {children}
        </main>
      </div>
    );
  }

  // Landing page (root) gets no wrapper - it handles its own layout
  if (isLandingPage) {
    return <>{children}</>;
  }

  // App pages get their own layout (handled by app/layout.tsx)
  if (isAppPage) {
    return <>{children}</>;
  }

  // Fallback for other pages (shouldn't happen with current structure)
  return <>{children}</>;
}