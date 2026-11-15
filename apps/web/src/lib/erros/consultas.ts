'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

/** Leitura dos relatos (spec 098): só o super admin. */
export type SituacaoErro = 'aberto' | 'voltou' | 'resolvido';
export interface GrupoErro {
  grupo: string; situacao: SituacaoErro; ocorrencias: number; pessoas: number; obras: number; comentarios: number;
  primeiro: string; ultimo: string; codigo: string; origem: string; tipo: string; mensagem: string; local: string;
  acao: string; status: number | null; nota: string | null; resolvido_por: string | null;
}
export interface ListaErros { grupos: GrupoErro[]; resumo: { abertos: number; ultimas_24h: number; grupos: number } }
export interface OcorrenciaErro {
  codigo: string; ocorrido_em: string; origem: string; tipo: string; mensagem: string; local: string; acao: string;
  status: number | null; pilha: string; comentario: string; versao: string; navegador: string; obra: string | null; usuario: string | null;
}
export interface DetalheErro { grupo: string; situacao: SituacaoErro; nota: string | null; resolvido_em: string | null; resolvido_por: string | null; ocorrencias: OcorrenciaErro[] }

export function useErros(f: { situacao: string; origem: string; busca: string }) {
  const api = useApi();
  const q = new URLSearchParams({ situacao: f.situacao, ...(f.origem ? { origem: f.origem } : {}), ...(f.busca ? { busca: f.busca } : {}) });
  return useQuery({ queryKey: ['erros', f], queryFn: () => api.get<ListaErros>(`/erros?${q}`), refetchInterval: 60_000 });
}

export function useDetalheErro(grupo: string | null) {
  const api = useApi();
  return useQuery({ queryKey: ['erros', 'grupo', grupo], enabled: !!grupo, queryFn: () => api.get<DetalheErro>(`/erros/grupos/${grupo}`) });
}

/** Grupos abertos, para o aviso no menu da conta do super admin. */
export function useErrosAbertos() {
  const api = useApi();
  const { superadminReal } = useObra();
  return useQuery({ queryKey: ['erros', 'resumo'], enabled: superadminReal, refetchInterval: 120_000, retry: 0,
    queryFn: () => api.get<{ abertos: number }>('/erros/resumo') });
}

export function useResolverErro() {
  const api = useApi();
  return useMutation({
    mutationFn: ({ grupo, resolver, nota }: { grupo: string; resolver: boolean; nota?: string }) =>
      resolver ? api.put(`/erros/grupos/${grupo}/resolver`, { nota: nota || null }) : api.del(`/erros/grupos/${grupo}/resolver`),
  });
}
