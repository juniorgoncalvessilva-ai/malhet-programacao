'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { DetalheRegistro, corStatusRegistro } from '@/components/Auditoria/DetalheRegistro';
import { TopoM } from '@/components/Mobile/ui';
import { Link } from '@/i18n/navigation';
import { dataBR, useRegistrosAuditoria } from '@/lib/auditorias';

/** Auditorias dos últimos 30 dias no celular: abrir, ver as fotos e reenviar pelo WhatsApp. */
export default function AuditoriasCampo() {
  const de = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const q = useRegistrosAuditoria(`?de=${de}`);
  const [aberto, setAberto] = useState<number | null>(null);
  return (
    <>
      <TopoM titulo="Auditorias" sub="últimos 30 dias" acao={<Link href="/m/auditorias/nova" aria-label="Nova auditoria" className="grid h-11 w-11 place-items-center rounded-full bg-m-accent-strong text-m-on-accent"><Plus size={22} /></Link>} />
      <Link href="/m/auditorias/nova" className="flex min-h-[56px] items-center justify-center gap-2 rounded-[14px] border-2 border-m-accent-strong bg-m-surface-raised text-[15px] font-semibold text-m-accent"><Plus size={18} /> Nova auditoria</Link>
      <Link href="/m/acoes" className="text-center text-[13px] font-semibold text-m-accent underline">Ações 5W2H (plano de ação)</Link>
      {q.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
      {q.data && !q.data.length && <p className="rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-5 text-[14px] text-m-text-secondary">Nenhuma auditoria nos últimos 30 dias.</p>}
      {(q.data ?? []).map((r) => (
        <article key={r.id} className="flex flex-col gap-2 rounded-[14px] border border-m-stroke-subtle bg-m-surface-raised p-3.5">
          <button type="button" onClick={() => setAberto(aberto === r.id ? null : r.id)} className="flex flex-col gap-1 text-left">
            <span className="flex items-start justify-between gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.4px] text-m-warning">{r.tipo} Nº {r.numero} · {r.tipo_registro}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${corStatusRegistro(r.status)}`}>{r.status_rotulo}</span>
            </span>
            <span className="text-[15px] font-medium leading-5">{r.nao_conformidade}</span>
            <span className="text-[12px] text-m-text-muted">{dataBR(r.data)} · {r.area_texto ?? '—'}{r.encarregado ? ` · ${r.encarregado}` : ''}</span>
          </button>
          {aberto === r.id && <DetalheRegistro r={r} />}
        </article>
      ))}
    </>
  );
}
