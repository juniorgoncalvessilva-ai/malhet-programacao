'use client';

import type { ReactNode } from 'react';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import type { GrupoGrafico } from '@/lib/api/types';

/** Cores do PAINEL AÇÃO do Plano de Ação 6WLA (as mesmas do Excel exportado). */
export const COR_STATUS: Record<string, string> = {
  'Concluído': '#00D661', 'No Prazo': '#008282', Reprogramado: '#FFC000', Atrasado: '#FF4747', Cancelado: '#BBBCBC',
};
export const COR_STATUS1: Record<string, string> = { Pendente: '#DA291C', 'Concluído': '#008282', Cancelado: '#BBBCBC' };

type Mem = Record<string, MemoriaCalculo>;
const valor = (m: Mem, chave: string, n: number): ReactNode =>
  m[chave] ? <Calculado chave={chave} memoria={() => m[chave]}>{n}</Calculado> : n;

function Legenda({ cores }: { cores: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-m-text-secondary">
      {Object.entries(cores).map(([k, c]) => <span key={k} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />{k}</span>)}
    </div>
  );
}

export function Cartao({ titulo, children, legenda }: { titulo: string; children: ReactNode; legenda?: Record<string, string> }) {
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-m-carimbo border border-m-stroke-subtle bg-m-surface-raised p-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-primary">{titulo}</h3>
      {legenda && <Legenda cores={legenda} />}
      {children}
    </section>
  );
}

/** Rosca do status das restrições (todas as ações por STATUS 2). */
export function Rosca({ grupos, mem }: { grupos: GrupoGrafico[]; mem: Mem }) {
  const total = grupos.reduce((s, g) => s + g.valores.total.n, 0) || 1;
  let acc = 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-[150px] w-[150px] shrink-0" role="img" aria-label="Status das restrições">
        {grupos.map((g) => {
          const frac = g.valores.total.n / total;
          const el = <circle key={g.rotulo} cx="70" cy="70" r={R} fill="none" stroke={COR_STATUS[g.rotulo] ?? '#999'} strokeWidth="24"
            strokeDasharray={`${Math.max(0, frac * C - 1.5)} ${C}`} strokeDashoffset={-acc * C} transform="rotate(-90 70 70)"><title>{`${g.rotulo}: ${g.valores.total.n}`}</title></circle>;
          acc += frac;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" className="fill-[var(--m-text-primary)] text-[22px] font-semibold">{total}</text>
        <text x="70" y="84" textAnchor="middle" className="fill-[var(--m-text-muted)] text-[10px]">ações</text>
      </svg>
      <ul className="flex flex-col gap-1.5 text-[12.5px]">
        {grupos.map((g) => (
          <li key={g.rotulo} className="flex items-center gap-2 text-m-text-secondary">
            <span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: COR_STATUS[g.rotulo] ?? '#999' }} />
            <span className="w-[100px]">{g.rotulo}</span>
            <b className="text-m-text-primary">{valor(mem, g.valores.total.chave, g.valores.total.n)}</b>
            <span className="text-m-text-muted">{Math.round((g.valores.total.n / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontais: uma série (cor única) ou empilhadas por série (cores). */
export function BarrasH({ grupos, mem, series, cores, cor = '#008282' }: {
  grupos: GrupoGrafico[]; mem: Mem; series?: string[]; cores?: Record<string, string>; cor?: string;
}) {
  const ss = series ?? ['total'];
  const max = Math.max(1, ...grupos.map((g) => ss.reduce((s, k) => s + (g.valores[k]?.n ?? 0), 0)));
  if (!grupos.length) return <p className="py-6 text-center text-[12.5px] text-m-text-muted">Nada a mostrar.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {grupos.map((g) => {
        const tot = ss.reduce((s, k) => s + (g.valores[k]?.n ?? 0), 0);
        return (
          <li key={g.rotulo} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_auto] items-center gap-2 text-[12px]" title={`${g.rotulo}: ${ss.map((k) => `${k === 'total' ? '' : `${k} `}${g.valores[k]?.n ?? 0}`).join(' · ')}`}>
            <span className="truncate text-m-text-secondary">{g.rotulo}</span>
            <span className="flex h-4 overflow-hidden rounded-r-[4px]" style={{ width: `${(tot / max) * 100}%`, minWidth: tot ? 3 : 0 }}>
              {ss.map((k) => (g.valores[k]?.n ? <span key={k} className="h-full border-r-2 border-m-surface-raised last:border-r-0" style={{ width: `${(g.valores[k].n / tot) * 100}%`, background: cores?.[k] ?? cor }} /> : null))}
            </span>
            <span className="whitespace-nowrap text-right text-m-text-primary">
              {ss.length > 1
                ? ss.filter((k) => g.valores[k]?.n).map((k, i) => <span key={k}>{i > 0 && <span className="text-m-text-tertiary"> · </span>}<span title={k}>{valor(mem, g.valores[k].chave, g.valores[k].n)}</span></span>)
                : <b>{valor(mem, g.valores.total.chave, g.valores.total.n)}</b>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Colunas (uma série): semana do projeto, gerência. */
export function Colunas({ grupos, mem, cor = '#008282' }: { grupos: GrupoGrafico[]; mem: Mem; cor?: string }) {
  const max = Math.max(1, ...grupos.map((g) => g.valores.total.n));
  if (!grupos.length) return <p className="py-6 text-center text-[12.5px] text-m-text-muted">Nada a mostrar.</p>;
  return (
    <div className="overflow-x-auto">
      <div className="flex h-44 min-w-full items-end gap-1.5 border-b border-m-stroke-subtle pb-1" style={{ width: Math.max(grupos.length * 44, 100) }}>
        {grupos.map((g) => (
          <div key={g.rotulo} className="flex h-full min-w-[36px] flex-1 flex-col items-center justify-end gap-1" title={`${g.rotulo}: ${g.valores.total.n}`}>
            <span className="text-[11.5px] font-semibold text-m-text-primary">{valor(mem, g.valores.total.chave, g.valores.total.n)}</span>
            <span className="w-full max-w-[34px] rounded-t-[4px]" style={{ height: `${(g.valores.total.n / max) * 100}%`, minHeight: 3, background: cor }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5" style={{ width: Math.max(grupos.length * 44, 100) }}>
        {grupos.map((g) => <span key={g.rotulo} className="min-w-[36px] flex-1 truncate text-center text-[10.5px] text-m-text-muted" title={g.rotulo}>{g.rotulo}</span>)}
      </div>
    </div>
  );
}
