'use client';

import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { hojeIso, num } from '@/components/Mobile/campo';
import { TopoM, cartaoM } from '@/components/Mobile/ui';
import { useProgramacao } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';

/** Programação vigente no celular: a última emissão, dia a dia (previsto × realizado). Aberta para todo mundo da obra. */
export default function VigenteCampoPage() {
  const api = useApi();
  const vig = useQuery({ queryKey: ['programacao', 'vigente'], queryFn: () => api.get<{ id: number | null; revisao: number | null; titulo: string | null }>('/programacoes/vigente') });
  const id = vig.data?.id ?? 0;
  const emissoes = useQuery({ queryKey: ['emissoes', id], enabled: !!id,
    queryFn: () => api.get<{ revisao: number; emitida_em: string }[]>(`/programacoes/${id}/emissoes`) });
  const rev = emissoes.data?.[0]?.revisao ?? null;
  const prog = useProgramacao(id, emissoes.isLoading ? undefined : rev);
  const v = prog.data;
  const [dia, setDia] = useState<number | null>(null);
  useEffect(() => {
    if (!v || dia != null) return;
    const k = v.dias.findIndex((d) => d.data === hojeIso());
    setDia(k >= 0 ? k : 0);
  }, [v, dia]);
  useEffect(() => { if (dia != null) document.getElementById(`dia-${dia}`)?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [dia]);
  const areas = useMemo(() => (v?.locais ?? []).flatMap((l) => l.areas.map((a) => ({ local: l, area: a }))), [v]);

  if (vig.isLoading || prog.isLoading) return <p className="pt-10 text-center text-sm text-m-text-muted">Carregando…</p>;
  if (!vig.data?.id || !v) return (<><TopoM titulo="Programação vigente" /><p className={`${cartaoM} text-center text-sm text-m-text-secondary`}>Nenhuma programação emitida ainda.</p></>);
  const k = dia ?? 0;
  const baixar = () => api.download(`/programacoes/${id}/excel${rev != null ? `?revisao=${rev}` : ''}`, `${v.titulo.split(' · ')[0]}${rev != null ? ` rev${rev}` : ''}.xlsx`).catch((e) => toast.error(e.message));

  return (
    <>
      <TopoM titulo="Programação vigente" sub={`${v.titulo}${rev != null ? ` · rev. ${rev}` : ' · rascunho'}`}
        acao={<button type="button" onClick={baixar} aria-label="Baixar Excel" className="grid h-11 w-11 place-items-center rounded-full border border-m-stroke text-m-accent"><FileSpreadsheet size={20} /></button>} />
      <div role="tablist" aria-label="Dia" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {v.dias.map((d, i) => (
          <button key={d.data} id={`dia-${i}`} type="button" role="tab" aria-selected={i === k} onClick={() => setDia(i)}
            className={`flex min-h-[52px] min-w-[52px] shrink-0 flex-col items-center justify-center rounded-[14px] px-2 text-[12px] ${i === k ? 'bg-m-accent-strong font-semibold text-m-on-accent' : 'border border-m-stroke text-m-text-secondary'}`}>
            <span>{d.dia}</span><span className="text-[15px] font-semibold">{d.data.slice(8)}/{d.data.slice(5, 7)}</span>
          </button>
        ))}
      </div>
      {areas.map(({ local, area }) => {
        const linhas = area.linhas.filter((ln) => ln.previsto[k] || ln.realizado[k]);
        if (!linhas.length) return null;
        return (
          <section key={`${local.id}-${area.id}`} className={cartaoM}>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">{local.codigo} · {local.descricao}</div>
              <h2 className="text-[16px] font-semibold leading-5">{area.codigo} · {area.descricao}</h2>
            </div>
            {linhas.map((ln) => {
              const p = ln.previsto[k] ?? 0;
              const r = ln.realizado[k];
              return (
                <div key={ln.id} className="flex items-start justify-between gap-3 border-t border-m-stroke-subtle pt-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium leading-5">{ln.descricao}</div>
                    <div className="text-[12px] text-m-text-muted">{ln.codigo_simova}{ln.encarregado || ln.equipe ? ` · ${ln.encarregado ?? ln.equipe}` : ''}</div>
                  </div>
                  <div className="shrink-0 text-right text-[13px]">
                    <div>P <b>{num(p)}</b> {ln.unidade ?? ''}</div>
                    <div className={r == null ? 'text-m-text-muted' : r + 0.005 < p ? 'text-m-warning' : 'text-m-success'}>R <b>{num(r)}</b></div>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
      {!areas.some(({ area }) => area.linhas.some((ln) => ln.previsto[k] || ln.realizado[k])) && <p className={`${cartaoM} text-center text-sm text-m-text-secondary`}>Nada programado neste dia.</p>}
    </>
  );
}
