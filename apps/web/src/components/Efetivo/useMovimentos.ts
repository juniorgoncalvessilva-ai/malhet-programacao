'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/programacao/useApi';
import type { MovimentoEfetivo } from '@/lib/api/types';

/** Histórico de uma pessoa do efetivo (entrada, situação, função, equipe). */
export function useMovimentosColaborador(id: number) {
  const api = useApi();
  return useQuery({ queryKey: ['efetivo', 'movimentos', id], queryFn: () => api.get<MovimentoEfetivo[]>(`/efetivo/movimentos?colaborador_id=${id}`) });
}
