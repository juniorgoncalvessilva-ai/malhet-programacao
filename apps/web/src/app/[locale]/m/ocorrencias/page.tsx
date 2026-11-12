'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { dataLonga, hojeIso } from '@/components/Mobile/campo';
import { Miniatura } from '@/components/Mobile/Fotos';
import { TopoM } from '@/components/Mobile/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import type { Desvio } from '@/lib/api/types';

const STATUS = { 1: 'Pendente', 2: 'Em andamento', 3: 'Concluído' } as const;

/** Ocorrências (desvios do Pareto) dos últimos 7 dias, com foto, e o atalho para registrar uma nova. */
export default function Ocorrencias() {
  const api = useApi();
  const de = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const q = useQuery({ queryKey: ['desvios', 'campo', de], queryFn: () => api.get<Desvio[]>(`/desvios?de=${de}&ate=${hojeIso()}`) });
  const lista = q.data ?? [];
  const porDia = lista.reduce<Record<string, Desvio[]>>((a, d) => { (a[d.data] ??= []).push(d); return a; }, {});
  return (
    <>
      <TopoM titulo="Ocorrências" sub="últimos 7 dias" acao={<Link href="/m/ocorrencias/nova" aria-label="Registrar ocorrência" className="grid h-11 w-11 place-items-center rounded-full bg-m-accent-strong text-m-on-accent"><Plus size={22} /></Link>} />
      <Link href="/m/ocorrencias/nova" className="flex min-h-[56px] items-center justify-center gap-2 rounded-[14px] border-2 border-m-accent-strong bg-m-surface-raised text-[15px] font-semibold text-m-accent"><Plus size={18} /> Registrar ocorrência</Link>
      {q.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
      {q.data && !lista.length && <p className="rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-5 text-[14px] text-m-text-secondary">Nenhuma ocorrência nos últimos 7 dias.</p>}
      {Object.entries(porDia).map(([data, itens]) => (
        <section key={data} className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold capitalize text-m-text-secondary">{dataLonga(data)} · {itens.length}</h2>
          {itens.map((d) => (
            <article key={d.id} className="flex flex-col gap-1.5 rounded-[14px] border border-m-stroke-subtle bg-m-surface-raised p-3.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[12px] font-medium uppercase leading-4 tracking-[0.48px] text-m-warning">{d.causa}</span>
                <span className="shrink-0 text-[11.5px] text-m-text-muted">{STATUS[d.status]}</span>
              </div>
              <span className="text-[15px] font-medium leading-5">{d.descricao}</span>
              <span className="text-[12px] leading-4 text-m-text-muted">{[d.frente, d.referencia, d.responsavel].filter(Boolean).join(' · ')}</span>
              {!!d.fotos?.length && <div className="flex flex-wrap gap-2 pt-1">{d.fotos.map((f) => <Miniatura key={f} id={f} tamanho={56} />)}</div>}
            </article>
          ))}
        </section>
      ))}
    </>
  );
}
