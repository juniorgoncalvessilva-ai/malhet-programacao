'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/programacao/useApi';

/** Auditorias por modelo e ações 5W2H (spec 064): tipos e consultas compartilhados entre o web e o celular. */
export type TipoCampo = 'tipo_auditoria' | 'frente' | 'data' | 'engenheiro' | 'encarregado' | 'rac' | 'tipo_registro'
  | 'nao_conformidade' | 'medida_corretiva' | 'ver_agir' | 'plano_acao' | 'acompanhamento' | 'texto';
export interface CampoModelo { chave: string; rotulo: string; emoji: string; tipo: TipoCampo; obrigatorio: boolean; ativo: boolean }
export interface ConfigModelo { nome: string; setor: string | null; cabecalho: string; rodape: string; tipos: { nome: string; registros: string[] }[]; campos: CampoModelo[] }
export interface ModeloAuditoria { id: number; nome: string; setor: string | null; padrao: boolean; ativo: boolean; config: ConfigModelo; registros: number }
export interface OpcoesAuditoria {
  equipes: { id: number; nome: string; encarregado: string | null; engenheiro: string | null; lider: string | null; frente: string | null }[];
  engenheiros: string[]; racs: { codigo: string; descricao: string | null }[];
}
export interface RegistroAuditoria {
  id: number; numero: number; modelo_id: number; tipo: string | null; tipo_registro: string | null; data: string; area_id: number | null;
  local: string | null; area_texto: string | null; equipe_id: number | null; engenheiro: string | null; encarregado: string | null; rac: string | null;
  nao_conformidade: string | null; medida_corretiva: string | null; ver_agir: boolean | null; plano_responsavel: string | null; plano_prazo: string | null;
  acompanhamento: string | null; respostas: Record<string, string> | null; status: 'rascunho' | 'adequada' | 'plano' | 'concluida'; status_rotulo: string;
  acao: { id: number; numero: number; status: string } | null; auditor: string | null; criado_em: string | null;
  fotos: { id: number; momento: 'antes' | 'depois' }[]; texto?: string;
}
export type StatusAcao = 'aberta' | 'andamento' | 'verificacao' | 'concluida' | 'cancelada';
export interface Acao5W2H {
  id: number; numero: number; origem: 'auditoria' | 'ocorrencia' | 'restricao' | 'reuniao' | 'manual'; origem_id: number | null; origem_texto: string | null;
  o_que: string; por_que: string | null; onde: string | null; area_id: number | null; quando: string | null; data_execucao: string | null;
  quem: string | null; como: string | null; quanto: string | null; acompanhamento: string | null; status: StatusAcao;
  farol: StatusAcao | 'vencida' | 'vence_logo' | 'no_prazo'; preenchidos: number; conclusao_texto: string | null; eficaz: boolean | null;
  historico: { em: string; por: string; texto: string }[] | null; fotos: number[]; criado_em: string | null;
}

export const ROTULO_STATUS_ACAO: Record<StatusAcao, string> = {
  aberta: 'Aberta', andamento: 'Em andamento', verificacao: 'Aguardando verificação', concluida: 'Concluída', cancelada: 'Cancelada',
};
export const ROTULO_ORIGEM: Record<Acao5W2H['origem'], string> = {
  auditoria: 'Auditoria', ocorrencia: 'Ocorrência', restricao: 'Restrição', reuniao: 'Reunião', manual: 'Manual',
};
export const FAROL_ACAO: Record<string, { rotulo: string; cls: string }> = {
  vencida: { rotulo: 'Vencida', cls: 'bg-m-danger-subtle text-m-danger' },
  vence_logo: { rotulo: 'Vence já', cls: 'bg-m-warning-subtle text-m-warning' },
  no_prazo: { rotulo: 'No prazo', cls: 'bg-m-success-subtle text-m-success' },
  verificacao: { rotulo: 'Verificar', cls: 'bg-m-info-subtle text-m-info' },
  concluida: { rotulo: 'Concluída', cls: 'bg-m-surface-active text-m-text-secondary' },
  cancelada: { rotulo: 'Cancelada', cls: 'bg-m-surface-active text-m-text-muted' },
  aberta: { rotulo: 'Aberta', cls: 'bg-m-surface-active text-m-text-secondary' }, andamento: { rotulo: 'Em andamento', cls: 'bg-m-surface-active text-m-text-secondary' },
};
export const dataBR = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—');

export function useModelosAuditoria() {
  const api = useApi();
  return useQuery({ queryKey: ['auditorias', 'modelos'], queryFn: () => api.get<ModeloAuditoria[]>('/auditorias/modelos') });
}
export function useOpcoesAuditoria() {
  const api = useApi();
  return useQuery({ queryKey: ['auditorias', 'opcoes'], queryFn: () => api.get<OpcoesAuditoria>('/auditorias/opcoes'), staleTime: 60000 });
}
export function useRegistrosAuditoria(filtro = '') {
  const api = useApi();
  return useQuery({ queryKey: ['auditorias', 'registros', filtro], queryFn: () => api.get<RegistroAuditoria[]>(`/auditorias/registros${filtro}`) });
}
export function useAcoes(filtro = '') {
  const api = useApi();
  return useQuery({ queryKey: ['acoes', filtro], queryFn: () => api.get<Acao5W2H[]>(`/acoes${filtro}`) });
}

/** Envia pelo WhatsApp: no celular, o compartilhamento nativo leva texto + fotos; sem ele, abre o WhatsApp só com o texto. */
export async function compartilharWhatsapp(texto: string, fotos: Blob[] = []): Promise<'nativo' | 'link'> {
  const arquivos = fotos.map((b, i) => new File([b], `foto-${i + 1}.jpg`, { type: b.type || 'image/jpeg' }));
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && arquivos.length && nav.canShare?.({ files: arquivos, text: texto })) {
    await nav.share({ files: arquivos, text: texto });
    return 'nativo';
  }
  if (nav.share && !arquivos.length) { await nav.share({ text: texto }); return 'nativo'; }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  return 'link';
}
