'use client';

import { useEffect, useState } from 'react';
import { ListaCampo } from '@/components/Documentos/ListaCampo';
import { Esqueleto } from '@/components/Obra/Esqueleto';
import type { DocumentoResumo } from '@/lib/documentos';
import { portal, portalBlob } from '@/lib/portal/api';

interface Frente { id: number; codigo: string; descricao: string }

/** Projetos e procedimentos pelo endereço do encarregado (spec 123): só a revisão vigente, da frente escolhida ou todos. */
export function ProjetosPortal() {
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [area, setArea] = useState('');
  const [docs, setDocs] = useState<DocumentoResumo[] | null>(null);
  useEffect(() => { portal<Frente[]>('/frentes').then(setFrentes).catch(() => setFrentes([])); }, []);
  useEffect(() => {
    setDocs(null);
    portal<DocumentoResumo[]>(`/documentos${area ? `?area_id=${area}` : ''}`).then(setDocs).catch(() => setDocs([]));
  }, [area]);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[14px] font-semibold">Frente
        <select aria-label="Frente dos projetos" value={area} onChange={(e) => setArea(e.target.value)}
          className="h-12 rounded-[14px] border border-m-stroke bg-m-surface-field px-3 text-[16px] font-normal">
          <option value="">Todas as frentes</option>
          {frentes.map((f) => <option key={f.id} value={f.id}>{f.codigo} · {f.descricao}</option>)}
        </select>
      </label>
      {docs === null ? <Esqueleto className="h-32 w-full" />
        : <ListaCampo docs={docs} abrir={(rid, f) => portalBlob(`/documentos/revisoes/${rid}/arquivo?formato=${f}`)}
          vazio={area ? 'Nenhum projeto vigente ligado a esta frente.' : 'Nenhum projeto vigente ainda.'} />}
    </div>
  );
}
