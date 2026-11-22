'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/programacao/useApi';
import type { MemoriaCalculo } from '@/components/Obra/Calculado';
import { useObra } from '@/lib/obra/ObraProvider';

/** Situação dos projetos da frente pelo controle de projetos por ativo (spec 133). */
export type StatusAtivo = 'ok' | 'parcial' | 'pendente' | 'critico' | 'sem_projeto' | 'revisao' | 'outro';
export interface SituacaoFrente {
  status: StatusAtivo; rotulo: string; libera: boolean; confirmada: boolean; total: number; vigentes: number;
  ativos: { texto: string; status: StatusAtivo; status_texto: string | null; linha: number | null }[];
  memoria: MemoriaCalculo;
}
export const TOM_STATUS: Record<StatusAtivo, 'sucesso' | 'info' | 'atencao' | 'perigo' | 'neutro'> = {
  ok: 'sucesso', parcial: 'info', pendente: 'atencao', critico: 'perigo', sem_projeto: 'neutro', revisao: 'info', outro: 'neutro',
};

/** Por frente (area_id): o pior status dos ativos dela e quantos projetos têm revisão vigente. Vazio sem controle importado. */
export function useSituacaoProjetos() {
  const api = useApi();
  const { obra } = useObra();
  const ligado = !obra?.telas_desligadas?.includes('/app/documentos');
  const q = useQuery({
    queryKey: ['documentos', 'ativos', 'situacao'], enabled: ligado, staleTime: 60_000,
    queryFn: () => api.get<Record<string, SituacaoFrente>>('/documentos/ativos/situacao'),
  });
  return (areaId: number | null | undefined): SituacaoFrente | undefined => (areaId ? q.data?.[String(areaId)] : undefined);
}
