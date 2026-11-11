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
export interface PessoaEfetivoEquipe {
  matricula: string | null; nome: string; funcao: string | null; funcao_cpu: string | null;
  situacao: SituacaoEfetivo; empresa: string; no_ultimo_arquivo: boolean;
}
export interface MembroEquipe { cracha: string; nome: string; funcao: string | null; efetivo?: PessoaEfetivoEquipe | null }
export interface Equipe {
  id: number; nome: string; frente_codigo: string | null; setor_id?: number | null; encarregado_cracha: string | null;
  encarregado_nome: string | null; jornada_horas: number; observacao: string | null; ativo: boolean;
  turno: string | null; codigo_simova: string | null; responsavel: string | null; equipamentos: string | null;
  composicao: ComposicaoEquipe[]; membros: MembroEquipe[]; composicao_efetiva: ComposicaoEquipe[]; hh_disponivel_dia: number;
  encarregado_efetivo?: PessoaEfetivoEquipe | null; fora_do_efetivo?: number;
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
export type PapelObra = 'admin' | 'planejador' | 'encarregado' | 'leitor' | 'seguranca';
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
/** Tipo = item da PQ vinculado ao grupo (descrição e unidade vêm da PQ vigente). */
export interface TipoCatalogo {
  id: number; grupo_id: number; numero: number; codigo: string; item_pq: string | null; descricao: string; unidade: string | null;
  quantidade_pq: number | null; pu: number | null; na_pq_vigente: boolean; ativo: boolean; itens: ItemCatalogo[];
}
export interface LinhaPq {
  item: string; nivel: number; folha: boolean; descricao: string; unid: string | null; codigo_atividade: string | null;
  criterio: string | null; quantidade: number | null; pu: number | null; total: number | null;
  tipo: { id: number; codigo: string; grupo: string } | null;
}
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
  qtd_periodo: number | null; natureza: 'P' | 'O' | 'E'; responsavel: string | null; turno: string | null;
  jornada: number | null; equipe_codigo: string | null; status_crono: string | null;
  realizado_anterior: number | null; restante: number | null; ssma: Ssma;
}
/** Técnico é um só; RAC, PTS, ART, ATA e PTO aceitam vários itens (emissões antigas podem trazer texto). */
export interface Ssma { tecnico: string | null; rac: ItensSsma; pts: ItensSsma; art: ItensSsma; pto: ItensSsma; ata: ItensSsma }
export type ItensSsma = string[] | string | null;
export const comoLista = (v: ItensSsma | undefined): string[] => (v == null ? [] : Array.isArray(v) ? v : [v]).filter(Boolean);
export interface AtividadeArvore {
  id_crono: string; atividade: string; caminho: string[]; inicio: string | null; fim: string | null;
  duracao_h: number | null; status: string | null; pct: number | null; programada_em: { id: number; titulo: string }[];
  /** Estrutura do Primavera: código e chave de ordem da WBS por nível; posição da atividade no P6. */
  wbs_codigos: string[] | null; wbs_ordem: string[] | null; ordem_p6: number | null;
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

/** Cadastros que alimentam as listas suspensas de SSMA (segurança) e o PTO (planejamento). */
export type TipoCadastroSsma = 'TECNICO' | 'RAC' | 'PTS' | 'ART' | 'ATA' | 'PTO';
export interface AnexoSsma { id: number; nome: string; content_type: string; tamanho: number; enviado_por: string; enviado_em: string }
export interface CadastroSsma {
  id: number; tipo: TipoCadastroSsma; codigo: string; descricao: string | null; validade: string | null; ativo: boolean; em_uso: number;
  aceita_anexo: boolean; anexos: AnexoSsma[];
}

/** Efetivo da obra (chave = matrícula) e mobilização. */
export type SituacaoEfetivo = 'MOBILIZADO' | 'AGUARDANDO_CRACHA' | 'EM_PROCESSO' | 'PREVISTO' | 'AFASTADO' | 'DESMOBILIZADO' | 'DESISTENCIA';
export interface Colaborador {
  id: number; chave: string; empresa: string; matricula: string | null; cracha: string | null; nome: string;
  funcao: string | null; funcao_composicao: string | null; dp: string | null; tipo_mo: string | null;
  status_original: string | null; situacao: SituacaoEfetivo; situacao_rotulo: string; mobilizacao_prevista: string | null;
  admissao: string | null; demissao: string | null; cracha_vale: string | null; rac2: boolean | null; paebm: boolean | null;
  no_ultimo_arquivo: boolean; equipe_id: number | null; equipe: string | null; encarregado_de: string | null;
}
export interface ResumoEfetivo {
  total: number; ativos: number; em_mobilizacao: number; sem_equipe: number; fora_do_ultimo_arquivo: number;
  por_situacao: Partial<Record<SituacaoEfetivo, number>>; por_empresa: Record<string, number>;
  desmobilizados_em_equipe: string[]; funcoes_sem_depara: number;
  ultima_importacao: { arquivo: string; em: string; resumo: Record<string, unknown> } | null;
}
export interface FuncaoDePara { funcao_chave: string; funcao: string; total: number; ativos: number; recurso: string | null; ignorar: boolean; definido: boolean; sugestao: string | null }
export interface NoOrganograma {
  id: string; tipo: 'obra' | 'setor' | 'equipe' | 'funcao'; titulo: string; detalhe: string; qtd: number;
  cor: string | null; responsavel: string | null;
  pessoas: { matricula: string; nome: string; funcao: string; situacao: string; turno: string }[]; filhos: NoOrganograma[];
}
export type NivelCor = 'obra' | 'setor' | 'equipe' | 'funcao';
export type CoresOrganograma = Record<NivelCor, string>;
export interface PessoaRef { id: number; nome: string; matricula: string | null; funcao: string | null; situacao: SituacaoEfetivo }
export interface SetorObra { id: number; nome: string; cor: string | null; ordem: number; responsavel: PessoaRef | null; equipes: { id: number; nome: string }[] }
export interface SetoresObra {
  setores: SetorObra[]; equipes: { id: number; nome: string; setor_id: number | null; ativo: boolean }[];
  responsavel_geral: PessoaRef | null; cores: CoresOrganograma; cores_padrao: CoresOrganograma;
}
export interface MovimentoEfetivo { id: number; colaborador_id: number; nome: string; tipo: string; de: string | null; para: string | null; em: string }
