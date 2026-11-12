'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiBlob, apiDownload, apiFetch, apiPostDownload } from '@/lib/api/client';
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
  const qc = useQueryClient();
  // tempo real: depois de salvar, todas as telas abertas recarregam com o dado novo (e a marca fica conhecida)
  const depois = useCallback(<T,>(p: Promise<T>): Promise<T> => p.then(async (r) => {
    const { recarregarTudo, lembrarMarca } = await import('@/lib/tempo-real');
    recarregarTudo(qc);
    apiFetch<{ marca: string }>('/mudancas', getToken, h()).then((m) => lembrarMarca(m.marca)).catch(() => undefined);
    return r;
  }), [qc, getToken, h]);
  return {
    get: useCallback(<T,>(p: string) => apiFetch<T>(p, getToken, h()), [getToken, h]),
    post: useCallback(<T,>(p: string, body?: unknown) =>
      depois(apiFetch<T>(p, getToken, h({ method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }))), [getToken, h, depois]),
    put: useCallback(<T,>(p: string, body: unknown) => depois(apiFetch<T>(p, getToken, h({ method: 'PUT', body: JSON.stringify(body) }))), [getToken, h, depois]),
    del: useCallback(<T = void,>(p: string) => depois(apiFetch<T>(p, getToken, h({ method: 'DELETE' }))), [getToken, h, depois]),
    download: useCallback((p: string, nome: string) => apiDownload(p, getToken, nome, obraId), [getToken, obraId]),
    blob: useCallback((p: string) => apiBlob(p, getToken, obraId), [getToken, obraId]),
    postDownload: useCallback((p: string, corpo: FormData, nome: string) => apiPostDownload(p, getToken, corpo, nome, obraId), [getToken, obraId]),
  };
}
