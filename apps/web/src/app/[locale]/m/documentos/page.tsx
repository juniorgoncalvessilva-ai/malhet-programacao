'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ListaCampo } from '@/components/Documentos/ListaCampo';
import { CampoM, TopoM, cartaoM } from '@/components/Mobile/ui';
import { Carregando } from '@/components/Obra/Esqueleto';
import { useFrentes2 } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import type { DocumentoResumo } from '@/lib/documentos';

const semAcento = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Projetos e procedimentos no celular (spec 123): só o que vale no campo (revisão vigente), da frente ou todos. */
export default function DocumentosCampoPage() {
  const api = useApi();
  const frentes = useFrentes2();
  const [area, setArea] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const areas = useMemo(() => (frentes.data ?? []).flatMap((l) => l.areas.filter((a) => a.ativo).map((a) => ({ ...a, local: `${l.codigo} · ${l.descricao}` }))), [frentes.data]);
  const q = useQuery({
    queryKey: ['documentos', 'campo', area],
    queryFn: async () => (area ? api.get<DocumentoResumo[]>(`/documentos/campo?area_id=${area}`) : (await api.get<DocumentoResumo[]>('/documentos')).filter((d) => d.vigente)),
  });
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const docs = (q.data ?? []).filter((d) => termos.every((t) => semAcento(`${d.codigo} ${d.titulo}`).includes(t)));
  const escolhida = areas.find((a) => a.id === area);
  return (
    <>
      <TopoM titulo="Projetos e procedimentos" sub="Só a revisão que vale no campo" voltar="/m" />
      <section className={cartaoM}>
        <label className="flex flex-col gap-1 text-[13px] font-medium text-m-text-secondary">Frente
          <select aria-label="Frente" value={area ?? ''} onChange={(e) => setArea(e.target.value ? Number(e.target.value) : null)}
            className="h-12 rounded-[14px] border border-m-stroke bg-m-surface-field px-3 text-[15px] text-m-text-primary">
            <option value="">Todas as frentes</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.descricao}</option>)}
          </select>
        </label>
        <CampoM rotulo="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="código ou título" />
      </section>
      {q.isLoading ? <Carregando /> : <ListaCampo docs={docs} abrir={(rid, f) => api.blob(`/documentos/revisoes/${rid}/arquivo?formato=${f}&via=campo`)}
        vazio={escolhida ? `Nenhum documento vigente ligado a ${escolhida.codigo}. Peça ao Planejamento para ligar o projeto à frente.` : 'Nenhum documento vigente ainda.'} />}
    </>
  );
}
