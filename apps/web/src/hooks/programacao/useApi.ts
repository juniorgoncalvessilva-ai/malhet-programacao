'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';
import { apiDownload, apiFetch } from '@/lib/api/client';

/** Fetcher autenticado com o token do Clerk (template opcional via NEXT_PUBLIC_CLERK_JWT_TEMPLATE_NAME). */
export function useApi() {
  const { getToken } = useAuth();
  const token = useCallback(
    async () => process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true' ? null : getToken(process.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE_NAME ? { template: process.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE_NAME } : undefined),
    [getToken],
  );
  return {
    get: useCallback(<T,>(p: string) => apiFetch<T>(p, token), [token]),
    post: useCallback(<T,>(p: string, body?: unknown) =>
      apiFetch<T>(p, token, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }), [token]),
    put: useCallback(<T,>(p: string, body: unknown) => apiFetch<T>(p, token, { method: 'PUT', body: JSON.stringify(body) }), [token]),
    del: useCallback((p: string) => apiFetch<void>(p, token, { method: 'DELETE' }), [token]),
    download: useCallback((p: string, nome: string) => apiDownload(p, token, nome), [token]),
  };
}
