'use client';

import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Colaborador } from '@/lib/api/types';
import { ROTULO_SITUACAO } from '@/lib/efetivo/situacoes';

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const FORA = new Set(['DESMOBILIZADO', 'DESISTENCIA']);

/**
 * Dropdown com busca no efetivo da obra (nome, matrícula, crachá ou função). Mostra até 50 resultados; quem casa com
 * `prioridade` (ex.: /ENCARREGADO/) vem primeiro. Desmobilizados ficam de fora. `ondeEsta` diz em que equipe a pessoa
 * já está (aviso, não bloqueia).
 */
export function BuscaEfetivo({ rotulo, pessoas, onEscolher, prioridade, excluir = [], ondeEsta, placeholder, className = '', manterAberto = false }: {
  rotulo: string; pessoas: Colaborador[]; onEscolher: (p: Colaborador) => void; prioridade?: RegExp; excluir?: string[];
  ondeEsta?: (p: Colaborador) => string | null; placeholder?: string; className?: string; manterAberto?: boolean;
}) {
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);
  const lista = useMemo(() => {
    const termo = sem(q.trim());
    const ex = new Set(excluir.filter(Boolean));
    return pessoas
      .filter((p) => !FORA.has(p.situacao) && !ex.has(p.cracha ?? '') && !ex.has(p.matricula ?? ''))
      .filter((p) => !termo || sem(`${p.nome} ${p.matricula ?? ''} ${p.cracha ?? ''} ${p.funcao ?? ''}`).includes(termo))
      .sort((a, b) => {
        const pa = prioridade?.test(a.funcao ?? '') ? 0 : 1;
        const pb = prioridade?.test(b.funcao ?? '') ? 0 : 1;
        return pa - pb || a.nome.localeCompare(b.nome, 'pt-BR');
      })
      .slice(0, 50);
  }, [pessoas, q, excluir, prioridade]);
  const escolher = (p: Colaborador) => {
    onEscolher(p);
    setQ('');
    setFoco(0);
    if (!manterAberto) setAberto(false);
  };
  return (
    <div ref={caixa} className={`relative flex flex-col gap-1.5 ${className}`}>
      <label className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted" htmlFor={`busca-${rotulo}`}>{rotulo}</label>
      <div className="flex h-10 items-center gap-2 rounded-m-md border border-m-stroke bg-m-surface-field px-3 focus-within:border-m-accent">
        <Search size={15} className="text-m-text-muted" aria-hidden="true" />
        <input id={`busca-${rotulo}`} role="combobox" aria-expanded={aberto} aria-controls={`lista-${rotulo}`} autoComplete="off"
          className="h-full w-full border-0 bg-transparent p-0 text-[14px] text-m-text-primary shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0" placeholder={placeholder ?? 'nome, matrícula, crachá ou função'}
          value={q} onFocus={() => setAberto(true)} onChange={(e) => { setQ(e.target.value); setAberto(true); setFoco(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setFoco((f) => Math.min(f + 1, lista.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setFoco((f) => Math.max(f - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); if (lista[foco]) escolher(lista[foco]); }
            else if (e.key === 'Escape') setAberto(false);
          }} />
      </div>
      {aberto && (
        <ul id={`lista-${rotulo}`} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-m-md border border-m-stroke bg-m-surface-raised py-1 shadow-lg">
          {lista.map((p, i) => {
            const onde = ondeEsta?.(p);
            return (
              <li key={p.id} role="option" aria-selected={i === foco}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(p)} onMouseEnter={() => setFoco(i)}
                  className={`flex w-full items-start justify-between gap-3 px-3 py-1.5 text-left ${i === foco ? 'bg-m-accent-subtle' : ''}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-m-text-primary">{p.nome}</span>
                    <span className="block truncate text-[11.5px] text-m-text-muted">{[p.matricula && `mat. ${p.matricula}`, p.cracha && p.cracha !== p.matricula && `crachá ${p.cracha}`, p.funcao].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px]">
                    {p.situacao !== 'MOBILIZADO' && <span className="block text-m-warning">{ROTULO_SITUACAO[p.situacao] ?? p.situacao}</span>}
                    {onde && <span className="block text-m-text-muted">{onde}</span>}
                  </span>
                </button>
              </li>
            );
          })}
          {!lista.length && <li className="px-3 py-2 text-[13px] text-m-text-muted">Ninguém no efetivo com “{q}”.</li>}
        </ul>
      )}
    </div>
  );
}
