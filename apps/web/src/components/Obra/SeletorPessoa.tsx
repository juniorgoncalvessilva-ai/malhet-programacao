'use client';

import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useApi } from '@/hooks/programacao/useApi';
import type { Colaborador, PessoaRef } from '@/lib/api/types';

const ATIVAS = 'MOBILIZADO,AGUARDANDO_CRACHA,EM_PROCESSO,PREVISTO,AFASTADO';

/** Escolhe uma pessoa do efetivo (busca por nome, matrícula ou função). */
export function SeletorPessoa({ rotulo, valor, onChange, disabled, placeholder = 'Buscar no efetivo: nome, matrícula ou função' }: {
  rotulo: string; valor: PessoaRef | null; onChange: (p: PessoaRef | null) => void; disabled?: boolean; placeholder?: string;
}) {
  const api = useApi();
  const id = useId();
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setTimeout(() => setQ(texto.trim()), 250); return () => clearTimeout(t); }, [texto]);
  useEffect(() => {
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);
  const busca = useQuery({
    queryKey: ['efetivo', 'busca-pessoa', q], enabled: q.length >= 2,
    queryFn: () => api.get<Colaborador[]>(`/efetivo/colaboradores?situacao=${ATIVAS}&q=${encodeURIComponent(q)}`),
  });
  const achados = (busca.data ?? []).slice(0, 8);

  return (
    <div className="flex flex-col gap-1.5" ref={caixa}>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">{rotulo}</label>
      {valor ? (
        <div className="flex h-10 items-center gap-2 rounded-[10px] border border-m-stroke bg-m-surface-field px-3 text-[13px]">
          <span className="min-w-0 flex-1 truncate"><b className="text-m-text-primary">{valor.nome}</b>
            <span className="text-m-text-muted"> · {[valor.matricula, valor.funcao].filter(Boolean).join(' · ')}</span></span>
          {!disabled && <button type="button" aria-label={`Tirar ${valor.nome}`} className="p-1 text-m-text-muted hover:text-m-danger" onClick={() => onChange(null)}><X size={14} /></button>}
        </div>
      ) : (
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-m-text-muted" />
          <input id={id} disabled={disabled} value={texto} placeholder={placeholder} autoComplete="off"
            onChange={(e) => { setTexto(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)}
            className="h-10 w-full rounded-[10px] border border-m-stroke bg-m-surface-field pl-8 pr-3 text-[13px] outline-none focus:border-m-accent disabled:opacity-60" />
          {aberto && q.length >= 2 && (
            <ul role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-[10px] border border-m-stroke bg-m-surface-raised py-1 shadow-lg">
              {busca.isLoading && <li className="px-3 py-2 text-[13px] text-m-text-muted">Buscando…</li>}
              {!busca.isLoading && !achados.length && <li className="px-3 py-2 text-[13px] text-m-text-muted">Ninguém ativo no efetivo com “{q}”.</li>}
              {achados.map((c) => (
                <li key={c.id} role="option" aria-selected={false}>
                  <button type="button" className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-m-surface-hover"
                    onClick={() => { onChange({ id: c.id, nome: c.nome, matricula: c.matricula, funcao: c.funcao, situacao: c.situacao }); setTexto(''); setAberto(false); }}>
                    <span className="text-[13px] font-medium text-m-text-primary">{c.nome}</span>
                    <span className="text-[11.5px] text-m-text-muted">{[c.matricula, c.funcao, c.empresa !== 'Própria' ? c.empresa : null, c.situacao_rotulo].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
