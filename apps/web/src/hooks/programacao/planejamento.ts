'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qs } from '@/lib/api/client';
import type { CadastroSsma, GrupoCatalogo, Local, ProgramacaoResumo, ProgramacaoVisao } from '@/lib/api/types';
import { useApi } from './useApi';

export const k = {
  frentes: ['frentes'] as const,
  catalogo: ['catalogo'] as const,
  programacoes: ['programacoes'] as const,
  programacao: (id: number) => ['programacao', id] as const,
  cadastrosSsma: ['cadastros-ssma'] as const,
};

/** Todos os cadastros de SSMA/PTO da obra (as telas filtram por tipo). */
export function useCadastrosSsma() {
  const api = useApi();
  return useQuery({ queryKey: k.cadastrosSsma, queryFn: () => api.get<CadastroSsma[]>('/ssma/cadastros') });
}

export function useFrentes2() {
  const api = useApi();
  return useQuery({ queryKey: k.frentes, queryFn: () => api.get<Local[]>('/frentes') });
}
export function useCatalogo() {
  const api = useApi();
  return useQuery({ queryKey: k.catalogo, queryFn: () => api.get<GrupoCatalogo[]>('/catalogo') });
}
export function useProgramacoes() {
  const api = useApi();
  return useQuery({ queryKey: k.programacoes, queryFn: () => api.get<ProgramacaoResumo[]>('/programacoes') });
}
export function useProgramacao(id: number, revisao?: number | null) {
  const api = useApi();
  return useQuery({
    queryKey: [...k.programacao(id), revisao ?? 'viva'],
    queryFn: () => api.get<ProgramacaoVisao>(revisao != null ? `/programacoes/${id}/emissoes/${revisao}` : `/programacoes/${id}`),
    enabled: !!id,
  });
}

/** Mutação genérica que invalida chaves ao terminar. */
export function useAcao<TIn, TOut = unknown>(fn: (api: ReturnType<typeof useApi>, d: TIn) => Promise<TOut>, invalida: readonly unknown[][]) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: TIn) => fn(api, d),
    onSuccess: () => invalida.forEach((c) => qc.invalidateQueries({ queryKey: c })),
  });
}

export const buscaPq = (q: string, tag?: string | null) => `/pq/itens${qs({ q, tag: tag ?? undefined, limite: 30 })}`;
export const buscaAtividades = (q: string, areaId?: number | null) => `/cronograma/atividades${qs({ q, area_id: areaId ?? undefined, limite: 30 })}`;
