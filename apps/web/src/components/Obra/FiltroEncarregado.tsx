'use client';

import { HardHat } from 'lucide-react';

/** Filtro da programação por encarregado (spec 047). */
export function FiltroEncarregado({ encs, valor, onChange }: {
  encs: { chave: string; nome: string; linhas: number }[]; valor: string; onChange: (v: string) => void;
}) {
  return (
    <label className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] print:hidden ${valor ? 'border-m-accent bg-m-accent-subtle text-m-accent' : 'border-m-stroke text-m-text-secondary'}`}>
      <HardHat size={14} aria-hidden="true" />
      <select aria-label="Filtrar por encarregado" value={valor} onChange={(e) => onChange(e.target.value)} className="max-w-[260px] bg-transparent font-semibold outline-none">
        <option value="">Todos os encarregados</option>
        {encs.map((e) => <option key={e.chave} value={e.chave}>{e.nome} · {e.linhas} linha(s)</option>)}
      </select>
    </label>
  );
}
