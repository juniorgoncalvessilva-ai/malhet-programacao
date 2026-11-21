import type { MemoriaCalculo } from '@/components/Obra/Calculado';
/** Spec 123 — documentos controlados (ISO 9001:2015, 7.5): tipos da API e rótulos. */
export type SituacaoRevisao = 'vigente' | 'em_analise' | 'superada' | 'cancelada';
export type FormatoRevisao = 'png' | 'pdf' | 'original' | 'dxf';

export interface RevisaoDoc {
  id: number; revisao: string; finalidade: string; situacao: SituacaoRevisao; data_emissao: string | null; nome_original: string | null;
  formatos: FormatoRevisao[]; tags: string[]; avisos: string[]; carimbo: Record<string, string>; grd_id: number | null;
  enviado_por: string; enviado_em: string | null;
}
export interface DocumentoResumo {
  id: number; codigo: string; codigo_contratada: string | null; titulo: string; tipo: string; tipo_nome: string; disciplina: string | null;
  projeto: string | null; origem: string; observacao: string | null; vigente: RevisaoDoc | null; ultima: RevisaoDoc | null;
  revisoes: number; sugestoes: number; ligacoes: number;
}
export interface VinculoDoc { id: number; relacao: string; relacao_nome: string; alvo_tipo: 'area' | 'wbs' | 'grupo' | 'documento'; alvo_id: number; alvo: string; sugerido: boolean }
export interface DocumentoDetalhe extends DocumentoResumo {
  historico: RevisaoDoc[]; vinculos: VinculoDoc[];
  citado_por: { documento_id: number; relacao_nome: string; documento: string }[];
  grds: { id: number; numero: string; sentido: 'recebida' | 'emitida'; data: string; revisao: string; finalidade: string }[];
  leituras: { revisao: string | null; quem: string; via: 'web' | 'campo' | 'portal'; formato: string; em: string | null }[];
}
export interface GrdResumo {
  id: number; numero: string; numero_externo: string | null; sentido: 'recebida' | 'emitida'; data: string; remetente: string;
  destinatario: string; itens: number; ciente_por: string | null; ciente_em: string | null;
}
export interface GrdDetalhe extends Omit<GrdResumo, 'itens'> {
  observacao: string | null; itens: { documento_id: number; codigo: string; titulo: string; revisao: string; finalidade: string; revisao_id: number | null }[];
}
export interface OpcoesDocumentos {
  tipos: Record<string, string>; finalidades: string[]; libera_uso: string[]; relacoes: Record<string, string>; disciplinas: string[]; conversor_dwg: boolean;
}
export interface Grafo { nos: { id: string; tipo: string; rotulo: string; titulo?: string; doc_tipo?: string; vigente?: string | null }[]; arestas: { de: string; para: string; relacao: string; sugerido: boolean }[] }

export const SITUACAO: Record<SituacaoRevisao, { rotulo: string; tom: 'sucesso' | 'atencao' | 'neutro' | 'perigo' }> = {
  vigente: { rotulo: 'Vigente', tom: 'sucesso' },
  em_analise: { rotulo: 'Em análise', tom: 'atencao' },
  superada: { rotulo: 'Superada', tom: 'neutro' },
  cancelada: { rotulo: 'Cancelada', tom: 'perigo' },
};
export const ALVO = { area: 'Frente', wbs: 'WBS', grupo: 'Grupo de atividade', documento: 'Documento' } as const;

// ---- take-off pelo projeto (spec 124) ----

export interface LinhaTakeoff {
  id: number; documento_id: number; documento: string; titulo: string; revisao_id: number; revisao: string;
  situacao_revisao: SituacaoRevisao | null; origem: 'quadro' | 'anotacao' | 'camada' | 'bloco'; chave: string; descricao: string;
  quantidade: number; unidade: string; fator: number; quantidade_final: number; memoria: MemoriaCalculo; avisos: string[];
  confere: boolean | null; situacao: 'extraido' | 'aceito' | 'descartado'; item_pq: string | null; item_descricao: string | null;
  item_unid: string | null; item_sugerido: string | null; sugerido_descricao: string | null; area_id: number | null; area: string | null;
  anterior: { revisao: string; quantidade: number } | null; delta: number | null; nova: boolean; wbs_no_id: number | null;
  decidido_por: string | null;
}
export interface ComparacaoTakeoff {
  item_pq: string; item_descricao: string | null; unidade: string; area_id: number; area: string | null; tag: string | null;
  projeto: number; planilha: number | null; iwp: number | null; diferenca: number | null; diferenca_pct: number | null;
  iwps: { id: number; codigo: string; quantidade: number | null; tem_etapas: boolean }[]; linhas: number[];
  memorias: { projeto: MemoriaCalculo; planilha: MemoriaCalculo };
}
export interface Takeoff { linhas: LinhaTakeoff[]; comparacao: ComparacaoTakeoff[] }
export const ORIGEM_TAKEOFF: Record<LinhaTakeoff['origem'], string> = { quadro: 'quadro do desenho', anotacao: 'anotação', camada: 'camada', bloco: 'bloco' };
