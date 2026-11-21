'use client';

import { ChevronRight, FileText } from 'lucide-react';
import { useState } from 'react';
import { VerRevisao } from '@/components/Documentos/VerRevisao';
import type { DocumentoResumo } from '@/lib/documentos';

/**
 * Lista de documentos vigentes para o campo (spec 123): código, título e a revisão que vale; tocar abre a folha.
 * `abrir(revId, formato)` busca o arquivo (app de campo com a conta do Malhet, ou o link do encarregado).
 */
export function ListaCampo({ docs, abrir, vazio }: { docs: DocumentoResumo[]; abrir: (revId: number, formato: 'png' | 'pdf') => Promise<Blob>; vazio: string }) {
  const [ver, setVer] = useState<DocumentoResumo | null>(null);
  if (!docs.length) return <p className="rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-5 text-[14px] text-m-text-secondary">{vazio}</p>;
  return (
    <>
      <ul className="flex flex-col gap-2">
        {docs.map((d) => (
          <li key={d.id}>
            <button type="button" onClick={() => setVer(d)} disabled={!d.vigente?.formatos.length}
              className="flex w-full items-center gap-3 rounded-[16px] border border-m-stroke-subtle bg-m-surface-raised px-3.5 py-3 text-left disabled:opacity-60">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-m-accent-subtle text-m-accent"><FileText size={19} /></span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[12px] font-semibold uppercase tracking-[0.3px] text-m-success">{d.tipo_nome} · rev. {d.vigente?.revisao}</span>
                <span className="text-[15px] font-medium leading-5">{d.codigo}</span>
                <span className="line-clamp-2 text-[12.5px] text-m-text-secondary">{d.titulo}</span>
                {!d.vigente?.formatos.length && <span className="text-[12px] text-m-warning">Arquivo ainda não enviado</span>}
              </span>
              <ChevronRight size={18} className="text-m-text-muted" />
            </button>
          </li>
        ))}
      </ul>
      {ver?.vigente && <VerRevisao titulo={`${ver.codigo} · rev. ${ver.vigente.revisao}`} sub={ver.titulo} onFechar={() => setVer(null)}
        png={ver.vigente.formatos.includes('png') ? () => abrir(ver.vigente!.id, 'png') : undefined}
        pdf={ver.vigente.formatos.includes('pdf') ? () => abrir(ver.vigente!.id, 'pdf') : undefined} />}
    </>
  );
}
