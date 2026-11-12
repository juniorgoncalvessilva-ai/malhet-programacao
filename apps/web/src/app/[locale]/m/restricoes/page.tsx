'use client';

import { Camera, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { dataLonga } from '@/components/Mobile/campo';
import { FAROL, useRestricoes } from '@/components/Mobile/restricoes';
import { TopoM } from '@/components/Mobile/ui';
import { Link } from '@/i18n/navigation';

const FILTROS = ['Pendentes', 'Atrasado', 'Reprogramado', 'No Prazo'] as const;

/** Restrições pendentes do look-ahead (6WLA): atrasadas primeiro; tocar abre para anotar, reprogramar, concluir e fotografar. */
export default function RestricoesCampo() {
  const q = useRestricoes();
  const [f, setF] = useState<(typeof FILTROS)[number]>('Pendentes');
  const pend = (q.data ?? []).filter((a) => a.status1 === 'Pendente');
  const ordem = { Atrasado: 0, Reprogramado: 1, 'No Prazo': 2 } as Record<string, number>;
  const lista = (f === 'Pendentes' ? pend : pend.filter((a) => a.status2 === f))
    .sort((a, b) => (ordem[a.status2] ?? 9) - (ordem[b.status2] ?? 9) || (a.prazo_termino ?? '').localeCompare(b.prazo_termino ?? ''));
  return (
    <>
      <TopoM titulo="Restrições" sub={`${pend.length} pendente(s) · 6WLA`} acao={<Link href="/m/restricoes/nova" aria-label="Nova restrição" className="grid h-11 w-11 place-items-center rounded-full bg-m-accent-strong text-m-on-accent"><Plus size={22} /></Link>} />
      <div role="tablist" aria-label="Filtro" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTROS.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={f === x} onClick={() => setF(x)}
            className={`h-10 shrink-0 rounded-full px-4 text-[14px] ${f === x ? 'bg-m-accent-strong font-semibold text-m-on-accent' : 'border border-m-stroke bg-m-surface-raised'}`}>
            {x}{x !== 'Pendentes' ? ` · ${pend.filter((a) => a.status2 === x).length}` : ''}
          </button>
        ))}
      </div>
      {q.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
      {q.data && !lista.length && <p className="rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-5 text-[14px] text-m-text-secondary">Nenhuma restrição aqui.</p>}
      <div className="flex flex-col gap-2">
        {lista.map((a) => (
          <Link key={a.id} href={`/m/restricoes/${a.id}`} className="flex items-center gap-3 rounded-[14px] border border-m-stroke-subtle bg-m-surface-raised p-3.5">
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${FAROL[a.status2]}`}>{a.status2}</span>
                <span className="text-[12px] text-m-text-muted">Nº {a.numero}{a.impeditivo ? ' · impeditiva' : ''}</span>
                {!!a.fotos?.length && <span className="inline-flex items-center gap-1 text-[12px] text-m-text-muted"><Camera size={13} />{a.fotos.length}</span>}
              </span>
              <span className="line-clamp-2 text-[15px] font-medium leading-5">{a.acao}</span>
              <span className="truncate text-[12px] leading-4 text-m-text-muted">{[a.area_texto, a.responsavel, a.reprogramado ? `reprog. ${dataLonga(a.reprogramado)}` : a.prazo_termino ? `até ${dataLonga(a.prazo_termino)}` : null].filter(Boolean).join(' · ')}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-m-text-muted" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </>
  );
}
