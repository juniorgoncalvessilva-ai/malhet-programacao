'use client';

import { useCallback } from 'react';
import { apiDownload, apiFetch } from '@/lib/api/client';
import { useSessao } from '@/lib/auth/AuthProvider';
import { useObraOpcional } from '@/lib/obra/ObraProvider';

/** Fetcher autenticado (auth-kit) e escopado na obra corrente (X-Obra-Id). */
export function useApi() {
  const { getToken } = useSessao();
  const obraId = useObraOpcional()?.obra?.id;
  const h = useCallback((init: RequestInit = {}): RequestInit => {
    const headers = new Headers(init.headers);
    if (obraId) headers.set('X-Obra-Id', String(obraId));
    return { ...init, headers };
  }, [obraId]);
  return {
    get: useCallback(<T,>(p: string) => apiFetch<T>(p, getToken, h()), [getToken, h]),
    post: useCallback(<T,>(p: string, body?: unknown) =>
      apiFetch<T>(p, getToken, h({ method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) })), [getToken, h]),
    put: useCallback(<T,>(p: string, body: unknown) => apiFetch<T>(p, getToken, h({ method: 'PUT', body: JSON.stringify(body) })), [getToken, h]),
    del: useCallback((p: string) => apiFetch<void>(p, getToken, h({ method: 'DELETE' })), [getToken, h]),
    download: useCallback((p: string, nome: string) => apiDownload(p, getToken, nome, obraId), [getToken, obraId]),
  };
}
