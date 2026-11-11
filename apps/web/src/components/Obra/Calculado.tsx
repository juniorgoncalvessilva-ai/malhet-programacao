'use client';

import { useQuery } from '@tanstack/react-query';
import { Calculator, FileSpreadsheet, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useApi } from '@/hooks/programacao/useApi';
import { cn } from '@/lib/utils';

/** Memória de cálculo devolvida pela API (`app/shared/memoria.py`). */
export interface MemoriaCalculo {
  chave: string; titulo: string; valor: string; formula: string;
  passos: { descricao: string; conta: string; resultado: string; destaque: boolean }[];
  fontes: { dado: string; valor: string; origem: string; local: string | null }[];
  notas: string[];
}
export type PacoteMemorias = { memorias: Record<string, MemoriaCalculo> };

/**
 * Número calculado clicável: abre a conta feita e a origem de cada dado.
 * `rota` devolve o pacote de memórias da API (uma rota por linha/equipe/item) e `chave` escolhe qual abrir;
 * para conta feita na própria tela, passe `memoria` (montada na hora do clique).
 * Regra: todo número calculado mostrado na tela usa este componente.
 */
export function Calculado({ rota, chave, memoria, children, className, titulo = 'Ver a conta e de onde vem cada dado' }: {
  rota?: string; chave: string; memoria?: () => MemoriaCalculo; children: ReactNode; className?: string; titulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" title={titulo} aria-label={`${titulo}: ${typeof children === 'string' ? children : chave}`}
        onClick={(e) => { e.stopPropagation(); setAberto(true); }}
        className={cn('cursor-help rounded-[3px] text-left underline decoration-dotted decoration-1 underline-offset-[3px] hover:text-m-accent hover:decoration-m-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-m-accent', className)}>
        {children}
      </button>
      {/* portal: a janela não herda alinhamento/fonte da célula da tabela onde o número está */}
      {aberto && createPortal(<JanelaMemoria rota={rota} chave={chave} local={memoria} onFechar={() => setAberto(false)} />, document.body)}
    </>
  );
}

function JanelaMemoria({ rota, chave, local, onFechar }: { rota?: string; chave: string; local?: () => MemoriaCalculo; onFechar: () => void }) {
  const api = useApi();
  const [atual, setAtual] = useState(chave);
  const [mLocal] = useState(() => (local ? local() : null));
  const q = useQuery({ queryKey: ['memoria', rota], queryFn: () => api.get<PacoteMemorias>(rota!), staleTime: 15_000, enabled: !!rota && !mLocal });
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);
  const todas = mLocal ? { [mLocal.chave]: mLocal } : q.data?.memorias ?? {};
  const m = todas[atual];
  const outras = Object.values(todas).filter((x) => x.chave !== atual);
  const th = 'px-2 py-1.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted';
  const td = 'border-t border-m-stroke-subtle px-2 py-1.5 align-top';
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 text-left font-normal normal-case tracking-normal print:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="memoria-titulo"
        className="flex max-h-[88vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[20px] border border-m-stroke bg-m-surface-raised shadow-2xl">
        <div className="flex items-start gap-3 border-b border-m-stroke-subtle px-6 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-m-accent-subtle text-m-accent" aria-hidden="true"><Calculator size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Memória de cálculo</p>
            <h2 id="memoria-titulo" className="text-[17px] font-semibold leading-6 text-m-text-primary">{m?.titulo ?? (q.isFetching ? 'Carregando…' : 'Sem memória')}</h2>
          </div>
          {m && <span className="shrink-0 rounded-[10px] bg-m-accent-subtle px-3 py-1.5 text-[18px] font-semibold tabular-nums text-m-accent">{m.valor}</span>}
          <button type="button" aria-label="Fechar" className="rounded-full p-1.5 text-m-text-muted hover:bg-m-surface-hover" onClick={onFechar}><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-4 overflow-auto px-6 py-4 text-[13px]">
          {q.error && <p className="text-m-danger">{(q.error as Error).message}</p>}
          {!q.isFetching && !m && !q.error && <p className="text-m-text-muted">Este número não tem memória de cálculo disponível.</p>}
          {m && <>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Fórmula</p>
              <p className="rounded-[10px] bg-m-surface-base px-3 py-2 font-mono text-[12.5px] text-m-text-primary">{m.formula}</p>
            </div>
            {!!m.passos.length && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Conta</p>
                <table className="w-full border-collapse">
                  <thead><tr><th className={th}>Parcela</th><th className={th}>Conta</th><th className={`${th} text-right`}>Resultado</th></tr></thead>
                  <tbody>
                    {m.passos.map((p, i) => (
                      <tr key={i} className={p.destaque ? 'bg-m-accent-subtle/60 font-semibold text-m-text-primary' : 'text-m-text-secondary'}>
                        <td className={td}>{p.descricao}</td>
                        <td className={`${td} font-mono text-[12px]`}>{p.conta}</td>
                        <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{p.resultado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!!m.fontes.length && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted"><FileSpreadsheet size={13} /> Fontes (de onde vem cada dado)</p>
                <table className="w-full border-collapse">
                  <thead><tr><th className={th}>Dado</th><th className={th}>Valor</th><th className={th}>Origem</th><th className={th}>Onde</th></tr></thead>
                  <tbody>
                    {m.fontes.map((f, i) => (
                      <tr key={i} className="text-m-text-secondary">
                        <td className={`${td} font-medium text-m-text-primary`}>{f.dado}</td>
                        <td className={`${td} tabular-nums`}>{f.valor}</td>
                        <td className={td}>{f.origem}</td>
                        <td className={`${td} text-m-text-muted`}>{f.local ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {m.notas.map((n) => <p key={n} className="rounded-[10px] bg-m-warning-subtle px-3 py-2 text-[12.5px] text-m-text-primary">{n}</p>)}
          </>}
          {outras.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Outros cálculos deste item</p>
              <div className="flex flex-wrap gap-1.5">
                {outras.map((o) => (
                  <button key={o.chave} type="button" onClick={() => setAtual(o.chave)}
                    className="rounded-full border border-m-stroke px-2.5 py-1 text-[12px] text-m-text-secondary hover:border-m-accent hover:text-m-accent">
                    {o.titulo} · <b className="tabular-nums">{o.valor}</b>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Formata como a API (pt-BR, sem zeros à direita) para as memórias montadas na tela. */
export const nbr = (v: number | null | undefined, casas = 2): string =>
  v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: casas });
