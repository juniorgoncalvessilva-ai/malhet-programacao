'use client';

import { useMemo, useState } from 'react';
import { useFrentes2 } from '@/hooks/programacao/planejamento';

/** Local / Frente da lista de Frentes: toque abre a lista, digitar filtra (código, nome ou local, sem acento). */
export function BuscaArea({ valor, onEscolher, rotulo = 'Local / Frente' }: { valor: number | null; onEscolher: (id: number | null, texto: string | null) => void; rotulo?: string }) {
  const frentes = useFrentes2();
  const areas = useMemo(() => (frentes.data ?? []).flatMap((l) => l.areas.filter((a) => a.ativo).map((a) => ({ ...a, local: `${l.codigo} · ${l.descricao}` }))), [frentes.data]);
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState(false);
  const sem = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const termos = sem(busca).split(/\s+/).filter(Boolean);
  const achadas = areas.filter((a) => termos.every((x) => sem(`${a.codigo} ${a.descricao} ${a.local}`).includes(x)));
  const atual = areas.find((a) => a.id === valor);
  if (atual) return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-m-text-secondary">{rotulo}</span>
      <div className="flex items-center justify-between gap-2 rounded-[14px] border border-m-accent-strong px-3.5 py-2.5 text-[14px]">
        <span className="min-w-0"><span className="block text-[11.5px] text-m-text-muted">{atual.local}</span><b>{atual.codigo}</b> · {atual.descricao}</span>
        <button type="button" className="shrink-0 text-[13px] font-semibold text-m-accent underline" onClick={() => onEscolher(null, null)}>trocar</button>
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-m-text-secondary">{rotulo}
        <input value={busca} role="combobox" aria-expanded={aberta} autoComplete="off" onFocus={() => setAberta(true)}
          onChange={(e) => { setBusca(e.target.value); setAberta(true); }} placeholder="Toque para ver as frentes ou digite"
          className="h-12 w-full rounded-[14px] border border-m-stroke bg-m-surface-field px-3.5 text-[15px] text-m-text-primary outline-none focus:border-m-accent" />
      </label>
      {aberta && (
        <div role="listbox" aria-label="Frentes" className="flex max-h-[40vh] flex-col overflow-y-auto rounded-[14px] border border-m-stroke bg-m-surface-raised">
          <div className="sticky top-0 flex justify-between border-b border-m-stroke-subtle bg-m-surface-raised px-3 py-2 text-[12px] text-m-text-muted">
            <span>{achadas.length} de {areas.length} frentes</span><button type="button" className="font-semibold text-m-accent" onClick={() => setAberta(false)}>fechar</button>
          </div>
          {achadas.map((a) => (
            <button key={a.id} type="button" role="option" aria-selected={false} onClick={() => { onEscolher(a.id, `${a.codigo} · ${a.descricao}`); setBusca(''); setAberta(false); }}
              className="flex min-h-[48px] flex-col justify-center border-b border-m-stroke-subtle px-3 py-1.5 text-left last:border-0">
              <span className="text-[14px]"><b>{a.codigo}</b> · {a.descricao}</span><span className="text-[11.5px] text-m-text-muted">{a.local}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
