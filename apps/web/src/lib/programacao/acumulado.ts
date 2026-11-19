import type { ConferenciaRealizado } from '@/lib/api/types';

/** Spec 116 — a mesma conta da API (planejamento/domain/acumulado.py), para mostrar ao vivo o que ainda não foi salvo. */
const TOL = 0.005;

/** Recalcula a conferência trocando o realizado do período pelo que está na tela (lançado e ainda não salvo). */
export function conferirAoVivo(base: ConferenciaRealizado, realizadoPeriodo: number): ConferenciaRealizado {
  const acumulado = base.feito_antes + realizadoPeriodo;
  const prog = base.programado_periodo;
  const acima_do_programado = prog != null && realizadoPeriodo > prog + TOL;
  if (base.qtd_projeto == null || base.qtd_projeto <= 0)
    return { ...base, situacao: 'sem_projeto', acumulado, realizado_periodo: realizadoPeriodo, saldo_projeto: null, percentual_projeto: null, acima_do_programado };
  const saldo = base.qtd_projeto - acumulado;
  const situacao = saldo < -TOL ? 'acima_do_projeto' : saldo <= TOL ? 'concluiu' : 'em_andamento';
  return { ...base, situacao, acumulado, realizado_periodo: realizadoPeriodo, saldo_projeto: saldo, percentual_projeto: acumulado / base.qtd_projeto, acima_do_programado };
}

/** Tom da conferência: passou do projeto (perigo), acima do programado (atenção), concluiu (sucesso). */
export function tomConferencia(c: ConferenciaRealizado): 'perigo' | 'atencao' | 'sucesso' | 'neutro' {
  if (c.situacao === 'acima_do_projeto') return 'perigo';
  if (c.acima_do_programado) return 'atencao';
  if (c.situacao === 'concluiu') return 'sucesso';
  return 'neutro';
}

export const COR_TOM = { perigo: 'text-m-danger', atencao: 'text-m-warning', sucesso: 'text-m-success', neutro: 'text-m-text-muted' } as const;
export const FUNDO_TOM = { perigo: 'bg-m-danger', atencao: 'bg-m-warning', sucesso: 'bg-m-success', neutro: 'bg-m-accent' } as const;
