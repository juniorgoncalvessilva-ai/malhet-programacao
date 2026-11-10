'use client';

import { useCallback } from 'react';
import { apiDownload, apiFetch } from '@/lib/api/client';
import { useSessao } from '@/lib/auth/AuthProvider';

/** Fetcher autenticado com o access token do auth-kit (renovado pelo cookie de refresh). */
export function useApi() {
  const { getToken } = useSessao();
  return {
    get: useCallback(<T,>(p: string) => apiFetch<T>(p, getToken), [getToken]),
    post: useCallback(<T,>(p: string, body?: unknown) =>
      apiFetch<T>(p, getToken, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }), [getToken]),
    put: useCallback(<T,>(p: string, body: unknown) => apiFetch<T>(p, getToken, { method: 'PUT', body: JSON.stringify(body) }), [getToken]),
    del: useCallback((p: string) => apiFetch<void>(p, getToken, { method: 'DELETE' }), [getToken]),
    download: useCallback((p: string, nome: string) => apiDownload(p, getToken, nome), [getToken]),
  };
}
