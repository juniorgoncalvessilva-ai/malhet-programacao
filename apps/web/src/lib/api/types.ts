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

// ---- obras e acessos
export type PapelObra = 'admin' | 'planejador' | 'encarregado' | 'leitor';
export interface Obra {
  id: number; codigo: string; nome: string; contrato: string | null; cliente: string | null; ativa: boolean; criado_em: string;
}
export interface MinhaObra extends Obra { papel: PapelObra }
export interface ObraAdmin extends Obra { usuarios: number }
export interface Acesso {
  id: number; obra_id: number; usuario_id: string; email: string; papel: PapelObra; cracha: string | null;
  concedido_por: string; concedido_em: string;
}
export interface ContaAdmin {
  id: string; email: string; roles: string[]; status: string; verificado: boolean; mfa_enabled: boolean;
  created_at: string; obras: { obra: string; papel: PapelObra }[];
}

// ---- programação simplificada (spec 008)
export interface Area { id: number; local_id: number; cwa: string; codigo: string; descricao: string; tag: string | null; ordem: number; ativo: boolean }
export interface Local { id: number; codigo: string; descricao: string; ordem: number; ativo: boolean; areas: Area[] }
export interface ItemCatalogo { id: number; tipo_id: number; numero: number; codigo: string; complemento: string; descricao: string; item_pq: string | null; ativo: boolean }
export interface TipoCatalogo { id: number; grupo_id: number; numero: number; codigo: string; descricao: string; unidade: string | null; ativo: boolean; itens_pq: string[]; itens: ItemCatalogo[] }
export interface GrupoCatalogo { id: number; numero: number; codigo: string; descricao: string; ativo: boolean; tipos: TipoCatalogo[] }
export interface ProgramacaoResumo { id: number; tipo: 'SEMANAL' | 'MENSAL'; titulo: string; inicio: string; fim: string; status: 'rascunho' | 'emitida'; revisao: number; linhas: number }
export interface LinhaVisao {
  id: number; n: number; area_id: number; tipo_id: number; item_simova_id: number | null;
  grupo: { codigo: string; descricao: string }; codigo_simova: string; descricao: string; complemento: string | null;
  unidade: string | null; item_pq: string | null; descricao_pq: string | null; pu: number | null;
  qtd_takeoff: number | null; qtd_projeto: number | null; id_crono: string | null; atividade_crono: string | null;
  equipe_id: number | null; equipe: string | null; encarregado: string | null; cracha: string | null; observacao: string | null;
  previsto: (number | null)[]; realizado: (number | null)[]; total_previsto: number; total_realizado: number;
  calc: CalculoLinha;
}
/** Produção da linha a partir da CPU da obra (HH/un, recurso que governa, índice, capacidade da equipe). */
export interface CalculoLinha {
  composicao: string | null; descricao_composicao?: string | null; hh_un: number | null; recurso_governa: string | null;
  coef_governa?: number | null; indice_un_dia: number | null; jornada: number; capacidade_un_dia: number | null;
  gargalo: string | null; apoio_externo: string[]; custo_unitario: number | null;
  hh_previsto: (number | null)[]; oficiais: (number | null)[]; acima_capacidade: boolean[];
  total_hh_previsto: number; total_hh_realizado: number; alertas: string[];
}
export interface RecursoCpuItem { recurso: string; tipo: 'MOD' | 'EQU'; coef: number; un_dia_por_pessoa: number | null }
export interface CpuDoItem {
  item: string; descricao: string | null; unid: string | null; pu: number | null; composicao: string | null;
  descricao_composicao: string | null; custo_unitario: number | null; hh_un: number | null; recurso_governa: string | null;
  coef_governa: number | null; jornada: number; indice_un_dia: number | null; recursos: RecursoCpuItem[];
}
export interface ProgramacaoVisao {
  id: number; tipo: 'SEMANAL' | 'MENSAL'; titulo: string; inicio: string; fim: string; status: 'rascunho' | 'emitida'; revisao: number;
  dias: { data: string; dia: string }[]; linhas: number;
  hh_previsto_dia?: number[]; total_hh_previsto?: number; total_hh_realizado?: number;
  locais: { id: number; codigo: string; descricao: string; areas: { id: number; codigo: string; cwa: string; descricao: string; tag: string | null; linhas: LinhaVisao[] }[] }[];
  emitida_em?: string; emitida_por?: string;
}
export interface ItemPqBusca { item: string; descricao: string; unid: string | null; quantidade: number | null; cpu: string | null; qtd_tag: number | null }
export interface AtividadeBusca { id_crono: string; atividade: string; inicio: string | null; fim: string | null; status: string | null; wbs: string | null }
