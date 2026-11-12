/**
 * Resumo agrupado do efetivo (spec 051): contagens por função, situação, tipo de MO, DP, empresa, equipe e admissão,
 * cada uma com a memória de cálculo (quem entrou na conta e de onde veio o dado).
 */
import type { MemoriaCalculo } from '@/components/Obra/Calculado';
import type { Colaborador, GrupoGrafico, SituacaoEfetivo } from '@/lib/api/types';
import { ROTULO_SITUACAO } from '@/lib/efetivo/situacoes';

export type Escopo = 'ativos' | 'mobilizacao' | 'todos';
export const ESCOPOS: { v: Escopo; rotulo: string; situacoes: SituacaoEfetivo[] }[] = [
  { v: 'ativos', rotulo: 'Ativos (mobilizados e afastados)', situacoes: ['MOBILIZADO', 'AFASTADO'] },
  { v: 'mobilizacao', rotulo: 'Em mobilização', situacoes: ['AGUARDANDO_CRACHA', 'EM_PROCESSO', 'PREVISTO'] },
  { v: 'todos', rotulo: 'Todos (menos desmobilizados)', situacoes: ['MOBILIZADO', 'AFASTADO', 'AGUARDANDO_CRACHA', 'EM_PROCESSO', 'PREVISTO'] },
];
export const COR_SITUACAO: Record<string, string> = {
  Mobilizado: '#008282', Afastado: '#FFC000', 'Aguardando crachá': '#4F8FD9', 'Em processo': '#7AA7E0', 'Mobilização prevista': '#B4CDEF',
};
export const COR_TIPO_MO: Record<string, string> = { MOD: '#008282', MOI: '#4F46E5', DEM: '#D97706', MOP: '#0891B2', AF: '#BBBCBC', 'Sem tipo': '#9CA3AF' };
export const SERIES_SITUACAO = ['Mobilizado', 'Afastado', 'Aguardando crachá', 'Em processo', 'Mobilização prevista'];

const sem = (v: string | null | undefined, padrao: string) => (v && v.trim() ? v.trim() : padrao);

export function noEscopo(lista: Colaborador[], escopo: Escopo, empresa: string) {
  const sit = new Set(ESCOPOS.find((e) => e.v === escopo)!.situacoes);
  return lista.filter((c) => sit.has(c.situacao) && (!empresa || c.empresa === empresa));
}

function memoria(chave: string, titulo: string, criterio: string, pessoas: Colaborador[], escopo: string, campo: string): MemoriaCalculo {
  return {
    chave, titulo, valor: `${pessoas.length} pessoa(s)`,
    formula: `contagem das pessoas do efetivo (${escopo}) com ${criterio}`,
    passos: pessoas.slice(0, 40).map((p) => ({ descricao: p.nome, conta: [p.matricula && `mat. ${p.matricula}`, p.funcao].filter(Boolean).join(' · '), resultado: ROTULO_SITUACAO[p.situacao] ?? p.situacao, destaque: false }))
      .concat(pessoas.length > 40 ? [{ descricao: `… e mais ${pessoas.length - 40}`, conta: '', resultado: '', destaque: false }] : [])
      .concat([{ descricao: 'Total', conta: `${pessoas.length} pessoa(s)`, resultado: String(pessoas.length), destaque: true }]),
    fontes: [{ dado: campo, valor: criterio, origem: 'Efetivo (planilha do DP importada)', local: `coluna ${campo} e STATUS de cada pessoa` }],
    notas: [],
  };
}

export interface Agrupado { grupos: GrupoGrafico[]; mem: Record<string, MemoriaCalculo>; pessoas: Record<string, Colaborador[]> }

/** Agrupa por `chaveDe` (uma série "total", ou séries por situação). */
export function agrupar(lista: Colaborador[], nome: string, chaveDe: (c: Colaborador) => string, escopo: string, campo: string,
  opcoes: { porSituacao?: boolean; ordem?: 'qtd' | 'rotulo'; limite?: number } = {}): Agrupado {
  const m = new Map<string, Colaborador[]>();
  for (const c of lista) { const k = chaveDe(c); m.set(k, [...(m.get(k) ?? []), c]); }
  let chaves = [...m.keys()];
  chaves.sort(opcoes.ordem === 'rotulo' ? (a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }) : (a, b) => m.get(b)!.length - m.get(a)!.length || a.localeCompare(b, 'pt-BR'));
  if (opcoes.limite) chaves = chaves.slice(0, opcoes.limite);
  const mem: Record<string, MemoriaCalculo> = {};
  const grupos = chaves.map((k) => {
    const ps = m.get(k)!;
    const valores: GrupoGrafico['valores'] = {};
    const ch = `${nome}:${k}:total`;
    valores.total = { n: ps.length, chave: ch };
    mem[ch] = memoria(ch, `${k}`, `${campo.toLowerCase()} = ${k}`, ps, escopo, campo);
    if (opcoes.porSituacao) {
      for (const s of SERIES_SITUACAO) {
        const qs = ps.filter((p) => (ROTULO_SITUACAO[p.situacao] ?? p.situacao) === s);
        if (!qs.length) continue;
        const cs = `${nome}:${k}:${s}`;
        valores[s] = { n: qs.length, chave: cs };
        mem[cs] = memoria(cs, `${k} · ${s}`, `${campo.toLowerCase()} = ${k} e situação ${s}`, qs, escopo, campo);
      }
    }
    return { rotulo: k, valores };
  });
  return { grupos, mem, pessoas: Object.fromEntries(chaves.map((k) => [k, m.get(k)!])) };
}

export const porFuncao = (c: Colaborador) => sem(c.funcao, 'Sem função');
export const porFuncaoCpu = (c: Colaborador) => sem(c.funcao_composicao, 'Sem de-para');
export const porSituacao = (c: Colaborador) => ROTULO_SITUACAO[c.situacao] ?? c.situacao;
export const porTipoMo = (c: Colaborador) => sem(c.tipo_mo, 'Sem tipo');
export const porDp = (c: Colaborador) => sem(c.dp, 'Sem DP');
export const porEmpresa = (c: Colaborador) => sem(c.empresa, 'Sem empresa');
export const porEquipe = (c: Colaborador) => (c.equipe ? 'Em equipe' : c.encarregado_de ? 'Encarregado' : 'Sem equipe');
export const porMesAdmissao = (c: Colaborador) => (c.admissao ? c.admissao.slice(0, 7) : 'Sem data');
