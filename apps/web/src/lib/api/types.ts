// Espelho dos schemas da API (apps/api). Mantenha em sincronia com os routers.
export type TipoReferencia = 'CRONOGRAMA' | 'PQ' | 'CPU' | 'INDICES' | 'SIMOVA';

export interface Frente { codigo: string; descricao: string; ativo: boolean }
export interface OperGrupo {
  id: number; codigo: string; descricao: string; unidade_medida: string | null;
  materiais: string[]; ativo: boolean; codigo_duplicado: boolean;
}
export interface Oper {
  id: number; codigo: string; descricao: string; grupo_codigo: string; materiais: string[];
  unidade_medida: string | null; hh_prev: number | null; ativo: boolean; tarefa_codigo: string | null;
  origem: 'simova' | 'app'; pendente_envio_simova: boolean;
}
export interface Versao {
  id: number; tipo: TipoReferencia; rotulo: string; data_base: string | null; arquivo_origem: string | null;
  vigente: boolean; qtd_itens: number; carregado_por: string; carregado_em: string;
}
export interface Atividade {
  id_crono: string; atividade: string; area: string | null; status: string | null; inicio: string | null;
  fim: string | null; unid: string | null; qtd_takeoff: number | null; item_pq: string | null; composicao: string | null;
}
export interface ItemPq {
  item: string; descricao: string; unid: string | null; quantidade: number | null; pu: number | null;
  composicao: string | null; recurso_governa: string | null; coef_governa: number | null;
}
export interface IndiceEspecifico {
  codigo: string; funcao_governa: string; unid: string | null; indice_un_dia: number;
  ajudante: string | null; ajudantes_por_oficial: number | null; fonte: string | null;
}
export interface VinculoIn {
  id_crono?: string | null; item_pq?: string | null; composicao?: string | null; indice_codigo?: string | null;
  simova_grupo_codigo: string; simova_oper_codigo: string; simova_tarefa_codigo?: string | null;
  frente_codigo?: string | null; ativo?: boolean;
}
export interface Vinculo extends VinculoIn { id: number; atualizado_por: string; atualizado_em: string }
export interface VinculoResolvido {
  vinculo_id: number; id_crono: string | null; atividade: string | null; item_pq: string | null;
  descricao_pq: string | null; composicao: string | null; unid: string | null; qtd: number | null;
  recurso_governa: string | null; indice_orcado_un_dia: number | null; indice_especifico: string | null;
  hh_por_unidade: number | null; pendencias: string[];
}
export interface ComposicaoEquipe { recurso: string; tipo: 'MOD' | 'EQU'; quantidade: number }
export interface Equipe {
  id: number; nome: string; frente_codigo: string | null; encarregado_cracha: string | null;
  encarregado_nome: string | null; jornada_horas: number; observacao: string | null; ativo: boolean;
  composicao: ComposicaoEquipe[]; hh_disponivel_dia: number;
}
export interface DiaPlano { data: string; pe: number | null; hh: number | null }
export interface ItemProgramacao {
  id: number; encarregado_cracha: string; encarregado_nome: string; grupo_codigo: string; grupo_descricao: string;
  oper_codigo: string; oper_descricao: string; frente_codigo: string; tarefa_codigo: string | null;
  observacao: string | null; data_inicio: string; data_fim: string; origem: 'cronograma' | 'pq' | 'padrao';
  status: 'rascunho' | 'aprovado' | 'exportado'; indice_hh_por_unidade: number | null; vinculo_id: number | null;
  id_crono: string | null; item_pq: string | null; composicao: string | null; versoes: Record<string, number>;
  dias: DiaPlano[];
}
export interface ItemIn {
  encarregado_cracha: string; encarregado_nome: string; grupo_codigo: string; oper_codigo: string;
  frente_codigo: string; data_inicio: string; data_fim: string; dias: DiaPlano[];
  observacao?: string | null; vinculo_id?: number | null; permitir_excesso?: boolean;
}
export interface Ocupacao { data: string; hh_disponivel: number; hh_programado: number; saldo: number; excedido: boolean }
export interface CriarItemOut { item: ItemProgramacao; hh_disponivel_dia: number; ocupacao: Ocupacao[]; avisos: string[] }
