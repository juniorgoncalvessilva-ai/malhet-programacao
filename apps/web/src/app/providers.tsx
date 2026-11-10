"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/providers/toast-provider";
import { ZustandProvider } from "@/providers/zustand-provider";
import AnalyticsProvider from "@/providers/analytics-provider";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';
import { useParams } from "next/navigation";

export function Providers({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const locale = (params?.locale as string) || 'pt-BR';

  return (
    <ClerkProvider
      signInUrl={`/${locale}/auth/sign-in`}
      signUpUrl={`/${locale}/auth/sign-up`}
      afterSignInUrl={`/${locale}`}
      afterSignUpUrl={`/${locale}`}
      signInFallbackRedirectUrl={`/${locale}`}
      signUpFallbackRedirectUrl={`/${locale}`}
    >
      <QueryClientProvider client={queryClient}>
        <AnalyticsProvider>
          <ThemeProvider defaultTheme="light" attribute="class">
            <ZustandProvider>
              {children}
              <ToastProvider />
              {process.env.NODE_ENV === 'development' && (
                <ReactQueryDevtools initialIsOpen={false} />
              )}
            </ZustandProvider>
          </ThemeProvider>
        </AnalyticsProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
