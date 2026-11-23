'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/programacao/useApi';

/** Partes da obra (spec 139): a gerência é sempre uma delas, com o nome da empresa ("CONTRATADA - CARDAN"). */
export type PapelParte = 'contratada' | 'contratante' | 'fiscalizacao' | 'projetos';
export interface ParteObra { papel: PapelParte; rotulo: string; nome: string | null; gerencia: string; da_marca: boolean }
export interface ResponsavelObra { id: number; papel: PapelParte; nome: string; funcao: string | null; colaborador_id: number | null; ativo: boolean; gerencia: string }
export interface Partes { partes: ParteObra[]; responsaveis: ResponsavelObra[] }

export function usePartes() {
  const api = useApi();
  return useQuery({ queryKey: ['partes'], queryFn: () => api.get<Partes>('/partes'), staleTime: 60_000 });
}
