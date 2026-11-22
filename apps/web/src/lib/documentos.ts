import type { MemoriaCalculo } from '@/components/Obra/Calculado';
/** Spec 123 — documentos controlados (ISO 9001:2015, 7.5): tipos da API e rótulos. */
export type SituacaoRevisao = 'vigente' | 'em_analise' | 'superada' | 'cancelada';
export type FormatoRevisao = 'png' | 'pdf' | 'original' | 'dxf';

export interface RevisaoDoc {
  id: number; revisao: string; finalidade: string; situacao: SituacaoRevisao; data_emissao: string | null; nome_original: string | null;
  formatos: FormatoRevisao[]; tags: string[]; avisos: string[]; carimbo: Record<string, string>; grd_id: number | null;
  enviado_por: string; enviado_em: string | null;
  /** Da LDO (spec 128): motivo da revisão, quando a LDO foi enviada, se o projeto foi apresentado e a quem, e qual LDO listou. */
  /** Spec 135: arquivos trocados nesta mesma revisão (o anterior fica guardado, com quem trocou e por quê). */
  anteriores?: { id: number; nome_original: string | null; enviado_por: string | null; enviado_em: string | null; motivo: string; substituido_por: string; substituido_em: string | null }[];
  motivo?: string | null; ldo_enviada_em?: string | null; apresentado?: boolean | null; apresentado_para?: string | null; ldo?: string | null;
}
export interface DocumentoResumo {
  id: number; codigo: string; codigo_contratada: string | null; titulo: string; tipo: string; tipo_nome: string; disciplina: string | null;
  projeto: string | null; origem: string; observacao: string | null; vigente: RevisaoDoc | null; ultima: RevisaoDoc | null;
  revisoes: number; sugestoes: number; ligacoes: number;
  pacote?: string | null; local_texto?: string | null; disciplina_sigla?: string | null;
  /** Spec 134: frentes confirmadas (aplica_a → área) e a data da última revisão enviada. */
  frentes?: number[]; atualizado_em?: string | null;
}
export interface ResultadoLdo {
  criados: number; atualizados: number; revisoes: number; ligados: number; sugeridos: number; frentes_nao_achadas: string[];
  locais_nao_achados: { local: string; documentos: number }[]; abas: { aba: string; documentos: number }[]; ignoradas: string[];
  avisos: string[]; ldo: { id: number; codigo: string; revisao: string | null; arquivo_guardado: boolean; historico: number } | null;
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
  atencao?: string | null; emitente?: string | null; referencia?: string | null; tem_arquivo?: boolean;
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

// ---- pastas e consolidado (spec 129) ----
export interface PastaDoc {
  id: number; codigo: string; nome: string; descricao: string | null; do_modelo: boolean; tipos: string[]; disciplinas: string[];
  pacotes: string[]; documentos: number; vigentes: number; ultima: string | null; por_pacote: Record<string, number>;
  natureza: 'documento' | 'registro'; responsavel: string | null; meio: string | null; local: string | null; retencao: string | null;
  por_disciplina: Record<string, number>;
  /** Spec 134: níveis das subpastas (pacote, frente, disciplina, tipo, ano) e os documentos da pasta. */
  subpastas: NivelPasta[]; membros: number[];
}
export type NivelPasta = 'pacote' | 'frente' | 'disciplina' | 'tipo' | 'ano';
export interface Pastas {
  pastas: PastaDoc[]; sem_pasta: number; sugestao: { nome: string; tipos: string[]; documentos: number } | null; documentos: number;
  faltam_do_modelo: string[]; armazenamento: { documentos: number; obra: number; limite: number };
  sem_pasta_ids: number[]; niveis: Record<NivelPasta, string>;
}
export interface ItemConsolidado {
  tipo: 'revisao' | 'grd'; id: number; documento_id: number | null; codigo: string; titulo: string; revisao: string | null;
  finalidade: string | null; data: string; pacote: string | null; situacao: 'assinado' | 'pendente'; detalhe: string; quem: string;
}
export interface Consolidado {
  inicio: string; fim: string; periodo: 'semana' | 'mes'; itens: ItemConsolidado[];
  totais: { itens: number; assinado: number; pendente: number; revisoes: number; grds: number };
}

/** Letra do TE (tipo de emissão) pela finalidade — a mesma tabela da API (`TIPO_EMISSAO`). */
const TE: Record<string, string> = {
  PRELIMINAR: 'A', 'PARA APROVAÇÃO': 'B', 'PARA CONHECIMENTO': 'C', 'PARA COTAÇÃO': 'D', 'PARA CONSTRUÇÃO': 'E',
  'CONFORME COMPRADO': 'F', 'CONFORME CONSTRUÍDO': 'G', CANCELADO: 'H',
};
const limpo = (t: string) => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9.-]+/g, '-').replace(/^-|-$/g, '');

/** Nome de todo arquivo que sai do Malhet (spec 129): OBRA_CÓDIGO_Rrev_TE.ext — o código da obra abre o nome, como no vídeo. */
export function nomeArquivo(obra: string | undefined, codigo: string, revisao: string | null, finalidade: string | null, ext: string) {
  const te = finalidade ? TE[finalidade] : undefined;
  return [obra && limpo(obra), limpo(codigo), revisao && `R${limpo(revisao)}`, te].filter(Boolean).join('_') + (ext ? `.${ext.replace(/^\./, '')}` : '');
}
