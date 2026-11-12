'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/programacao/useApi';
import type { AcaoRestricao } from '@/lib/api/types';

export const SEIS_M: Record<string, string> = { MDO: 'Mão de obra', MET: 'Método', MAT: 'Material', MAQ: 'Máquina', MAB: 'Meio ambiente', MED: 'Medida' };
/** Cor do farol (texto + fundo) por STATUS 2, sempre com o nome escrito ao lado. */
export const FAROL: Record<string, string> = {
  Atrasado: 'bg-m-danger-subtle text-m-danger', Reprogramado: 'bg-m-warning-subtle text-m-warning',
  'No Prazo': 'bg-m-success-subtle text-m-success', 'Concluído': 'bg-m-info-subtle text-m-info', Cancelado: 'bg-m-surface-active text-m-text-muted',
};

export function useRestricoes() {
  const api = useApi();
  return useQuery({ queryKey: ['restricoes'], queryFn: () => api.get<AcaoRestricao[]>('/restricoes') });
}

/** Corpo do PUT a partir da ação como está (o celular muda só um campo por vez). */
export const corpoRestricao = (a: AcaoRestricao, mudar: Record<string, unknown> = {}) => ({
  acao: a.acao, atividade: a.atividade, impeditivo: a.impeditivo, area_id: a.area_id, area_texto: a.area_texto,
  referencia: a.referencia, reuniao: a.reuniao, responsavel: a.responsavel, gerencia: a.gerencia,
  prazo_inicio: a.prazo_inicio, prazo_termino: a.prazo_termino, status1: a.status1, conclusao: a.conclusao,
  seis_m: a.seis_m, linha_id: a.linha_id, equipe_id: a.equipe_id, ...mudar,
});
