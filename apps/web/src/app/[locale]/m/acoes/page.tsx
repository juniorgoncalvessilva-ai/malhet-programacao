'use client';

import { useState } from 'react';
import { AcaoDetalhe } from '@/components/Auditoria/AcaoDetalhe';
import { TopoM } from '@/components/Mobile/ui';
import { FAROL_ACAO, dataBR, useAcoes } from '@/lib/auditorias';

/** Ações 5W2H abertas no celular: iniciar, concluir com foto (evidência) e verificar a eficácia (spec 064). */
export default function AcoesCampo() {
  const q = useAcoes('?status=aberta,andamento,verificacao');
  const [aberta, setAberta] = useState<number | null>(null);
  return (
    <>
      <TopoM titulo="Ações 5W2H" sub="abertas e aguardando verificação" voltar="/m" />
      {q.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
      {q.data && !q.data.length && <p className="rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-5 text-[14px] text-m-text-secondary">Nenhuma ação aberta.</p>}
      {(q.data ?? []).map((a) => {
        const f = FAROL_ACAO[a.farol] ?? FAROL_ACAO[a.status];
        return (
          <article key={a.id} className="flex flex-col gap-2 rounded-[14px] border border-m-stroke-subtle bg-m-surface-raised p-3.5">
            <button type="button" onClick={() => setAberta(aberta === a.id ? null : a.id)} className="flex flex-col gap-1 text-left">
              <span className="flex items-start justify-between gap-2">
                <span className="text-[12px] font-semibold text-m-text-muted">A-{a.numero}{a.origem_texto ? ` · ${a.origem_texto}` : ''}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${f.cls}`}>{f.rotulo}</span>
              </span>
              <span className="text-[15px] font-medium leading-5">{a.o_que}</span>
              <span className="text-[12px] text-m-text-muted">{a.quem ?? '—'} · prazo {dataBR(a.quando)}{a.onde ? ` · ${a.onde}` : ''}</span>
            </button>
            {aberta === a.id && <AcaoDetalhe a={a} />}
          </article>
        );
      })}
    </>
  );
}
