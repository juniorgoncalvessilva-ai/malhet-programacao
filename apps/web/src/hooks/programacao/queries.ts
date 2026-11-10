'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qs } from '@/lib/api/client';
import type {
  Atividade, CriarItemOut, Equipe, Frente, IndiceEspecifico, ItemIn, ItemPq, ItemProgramacao, Oper, OperGrupo,
  Versao, Vinculo, VinculoIn, VinculoResolvido,
} from '@/lib/api/types';
import { useApi } from './useApi';

export const chaves = {
  frentes: ['frentes'] as const,
  grupos: ['oper-grupos'] as const,
  opers: (grupo?: string) => ['opers', grupo ?? ''] as const,
  versoes: ['versoes'] as const,
  vinculos: ['vinculos'] as const,
  equipes: ['equipes'] as const,
  itens: (inicio: string, fim: string) => ['itens', inicio, fim] as const,
};

export function useFrentes() {
  const api = useApi();
  return useQuery({ queryKey: chaves.frentes, queryFn: () => api.get<Frente[]>('/cadastros/frentes') });
}
export function useGrupos() {
  const api = useApi();
  return useQuery({ queryKey: chaves.grupos, queryFn: () => api.get<OperGrupo[]>('/cadastros/oper-grupos') });
}
export function useOpers(grupo?: string) {
  const api = useApi();
  return useQuery({ queryKey: chaves.opers(grupo), queryFn: () => api.get<Oper[]>(`/cadastros/opers${qs({ grupo })}`) });
}
export function useVersoes() {
  const api = useApi();
  return useQuery({ queryKey: chaves.versoes, queryFn: () => api.get<Versao[]>('/referencias/versoes') });
}
export function useVinculos() {
  const api = useApi();
  return useQuery({ queryKey: chaves.vinculos, queryFn: () => api.get<Vinculo[]>('/referencias/vinculos') });
}
export function useEquipes() {
  const api = useApi();
  return useQuery({ queryKey: chaves.equipes, queryFn: () => api.get<Equipe[]>('/equipes') });
}
export function useItens(inicio: string, fim: string) {
  const api = useApi();
  return useQuery({
    queryKey: chaves.itens(inicio, fim),
    queryFn: () => api.get<ItemProgramacao[]>(`/programacao/itens${qs({ inicio, fim })}`),
    enabled: !!inicio && !!fim,
  });
}
export function useBuscaAtividades(q: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['atividades', q],
    queryFn: () => api.get<Atividade[]>(`/referencias/atividades${qs({ q, limite: 30 })}`),
    enabled: q.length >= 2,
  });
}
export function useBuscaPq(q: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['pq', q],
    queryFn: () => api.get<ItemPq[]>(`/referencias/pq${qs({ q, limite: 30 })}`),
    enabled: q.length >= 2,
  });
}
export function useIndices() {
  const api = useApi();
  return useQuery({ queryKey: ['indices'], queryFn: () => api.get<IndiceEspecifico[]>('/referencias/indices'), retry: false });
}

export function useResolverVinculo() {
  const api = useApi();
  return useMutation({ mutationFn: (id: number) => api.get<VinculoResolvido>(`/referencias/vinculos/${id}/resolver`) });
}

export function useSalvarVinculo() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id?: number; dados: VinculoIn }) =>
      id ? api.put<Vinculo>(`/referencias/vinculos/${id}`, dados) : api.post<Vinculo>('/referencias/vinculos', dados),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.vinculos }),
  });
}
export function useExcluirVinculo() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/referencias/vinculos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.vinculos }),
  });
}
export function useAtivarVersao() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Versao>(`/referencias/versoes/${id}/ativar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.versoes }),
  });
}
export function useUpload(path: string, invalida: readonly unknown[][]) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fd: FormData) => api.post<Record<string, unknown>>(path, fd),
    onSuccess: () => invalida.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });
}
export function useCriarItem() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: ItemIn) => api.post<CriarItemOut>('/programacao/itens', dados),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itens'] }),
  });
}
export function useAcaoItem() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, acao }: { id: number; acao: 'aprovar' | 'excluir' }) =>
      acao === 'aprovar' ? api.post(`/programacao/itens/${id}/aprovar`) : api.del(`/programacao/itens/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itens'] }),
  });
}
