"use client";

import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ToastProvider } from "@/providers/toast-provider";
import { ZustandProvider } from "@/providers/zustand-provider";
import AnalyticsProvider from "@/providers/analytics-provider";
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/lib/auth/AuthProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <AnalyticsProvider>
          <ThemeProvider defaultTheme="light" attribute="class">
            <ZustandProvider>
              {children}
              <ToastProvider />
              {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
            </ZustandProvider>
          </ThemeProvider>
        </AnalyticsProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
