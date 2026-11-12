'use client';

import { ChevronRight } from 'lucide-react';
import { dataLonga, hojeIso, num, useDiaCampo } from '@/components/Mobile/campo';
import { Link } from '@/i18n/navigation';

/** Dias anteriores da programação com previsto e sem realizado lançado. */
export default function Pendencias() {
  const dia = useDiaCampo(hojeIso());
  const p = dia.data?.pendentes ?? [];
  const porDia = p.reduce<Record<string, typeof p>>((acc, x) => { (acc[x.data] ??= []).push(x); return acc; }, {});
  return (
    <>
      <h1 className="text-[24px] font-semibold leading-[30px]">Pendências</h1>
      {dia.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
      {dia.data && !p.length && <p className="rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-5 text-[14px] text-m-text-secondary">Nenhum dia sem realizado nesta programação.</p>}
      {Object.entries(porDia).map(([data, itens]) => (
        <section key={data} className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold capitalize text-m-text-secondary">{dataLonga(data)} · {itens.length} sem realizado</h2>
          {itens.map((x) => (
            <Link key={`${data}-${x.id}`} href={`/m/lancar?data=${data}&linha=${x.id}`} className="flex min-h-[60px] items-center gap-3 rounded-[14px] border border-m-stroke-subtle bg-m-surface-raised px-3.5 py-2">
              <span className="flex flex-1 flex-col"><span className="line-clamp-1 text-[15px] font-medium leading-5">{x.codigo_simova} · {x.descricao}</span>
                <span className="text-[12px] leading-4 text-m-text-muted">{x.area.split(' · ')[0]} · previsto {num(x.previsto)} {x.unidade ?? ''}</span></span>
              <ChevronRight size={18} className="text-m-text-muted" aria-hidden="true" />
            </Link>
          ))}
        </section>
      ))}
    </>
  );
}
