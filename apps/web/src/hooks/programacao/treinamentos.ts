'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/programacao/useApi';
import type {
  AsoReg, EtapasMobilizacao, ExigenciaFuncao, FichaColaborador, IndicadoresTreinamentos, MatrizTreinamentos,
  FuncaoContratacao, MetricasMobilizacao, PessoaSeguranca, TreinamentoPrevisto, VagasResposta, ProcessoMobilizacao, RegistroTreinamento, Treinamento,
} from '@/lib/api/types';

/** Consultas da ficha do colaborador e da mobilização (spec 087) e de ASOs/treinamentos (spec 088). */
export function useFicha(id: number | null) {
  const api = useApi();
  return useQuery({ queryKey: ['efetivo', 'ficha', id], queryFn: () => api.get<FichaColaborador>(`/efetivo/colaboradores/${id}`), enabled: !!id });
}
export function useProcessos(colaboradorId?: number | null) {
  const api = useApi();
  const q = colaboradorId ? `?colaborador_id=${colaboradorId}` : '';
  return useQuery({ queryKey: ['mobilizacao', 'processos', colaboradorId ?? null], queryFn: () => api.get<ProcessoMobilizacao[]>(`/mobilizacao/processos${q}`), enabled: colaboradorId !== null });
}
export function useEtapasMobilizacao() {
  const api = useApi();
  return useQuery({ queryKey: ['mobilizacao', 'etapas'], queryFn: () => api.get<EtapasMobilizacao>('/mobilizacao/etapas'), staleTime: 60_000 });
}
export function useMetricasMobilizacao(f: { desde?: string; ate?: string; funcao?: string }) {
  const api = useApi();
  const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({ queryKey: ['mobilizacao', 'metricas', p], queryFn: () => api.get<MetricasMobilizacao>(`/mobilizacao/metricas${p ? `?${p}` : ''}`) });
}
export function useTreinamentos() {
  const api = useApi();
  return useQuery({ queryKey: ['treinamentos', 'catalogo'], queryFn: () => api.get<Treinamento[]>('/treinamentos/catalogo') });
}
export function useExigencias() {
  const api = useApi();
  return useQuery({ queryKey: ['treinamentos', 'exigencias'], queryFn: () => api.get<ExigenciaFuncao[]>('/treinamentos/exigencias') });
}
export function useAsos() {
  const api = useApi();
  return useQuery({ queryKey: ['treinamentos', 'asos'], queryFn: () => api.get<AsoReg[]>('/treinamentos/asos') });
}
export function useRegistrosTreinamento(treinamentoId?: number | null) {
  const api = useApi();
  const q = treinamentoId ? `?treinamento_id=${treinamentoId}` : '';
  return useQuery({ queryKey: ['treinamentos', 'registros', treinamentoId ?? null], queryFn: () => api.get<RegistroTreinamento[]>(`/treinamentos/registros${q}`) });
}
export function useMatrizTreinamentos() {
  const api = useApi();
  return useQuery({ queryKey: ['treinamentos', 'matriz'], queryFn: () => api.get<MatrizTreinamentos>('/treinamentos/matriz') });
}
export function useIndicadoresTreinamentos(janela: number) {
  const api = useApi();
  return useQuery({ queryKey: ['treinamentos', 'indicadores', janela], queryFn: () => api.get<IndicadoresTreinamentos>(`/treinamentos/indicadores?janela=${janela}`) });
}
export function usePessoaSeguranca(id: number | null) {
  const api = useApi();
  return useQuery({ queryKey: ['treinamentos', 'pessoa', id], queryFn: () => api.get<PessoaSeguranca>(`/treinamentos/pessoa/${id}`), enabled: !!id });
}
export function useFuncoesContratacao() {
  const api = useApi();
  return useQuery({ queryKey: ['efetivo', 'funcoes-lista'], queryFn: () => api.get<FuncaoContratacao[]>('/efetivo/funcoes/lista') });
}
export function useVagas() {
  const api = useApi();
  return useQuery({ queryKey: ['mobilizacao', 'vagas'], queryFn: () => api.get<VagasResposta>('/mobilizacao/vagas') });
}
export function useTreinamentoPrevisto() {
  const api = useApi();
  return useQuery({ queryKey: ['mobilizacao', 'config-treinamentos'], queryFn: () => api.get<TreinamentoPrevisto[]>('/mobilizacao/config/treinamentos') });
}
