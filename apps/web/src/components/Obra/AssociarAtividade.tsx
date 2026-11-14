'use client';

import { useQuery } from '@tanstack/react-query';
import { Link2, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Botao } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';

export interface AtividadeCrono { id_crono: string; atividade: string; inicio: string | null; fim: string | null; status: string | null; wbs: string | null }
const dBR = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

/** Busca de atividade do cronograma vigente (código ou nome), opcionalmente só da área (spec 080). */
export function BuscaAtividadeCrono({ areaId, onEscolher, autoFocus = false }: { areaId?: number | null; onEscolher: (a: AtividadeCrono) => void; autoFocus?: boolean }) {
  const api = useApi();
  const [q, setQ] = useState('');
  const [soArea, setSoArea] = useState(!!areaId);
  const termo = q.trim();
  const r = useQuery({
    queryKey: ['cronograma', 'busca', termo, soArea ? areaId : null], enabled: termo.length >= 2 || (soArea && !!areaId),
    queryFn: () => api.get<AtividadeCrono[]>(`/cronograma/atividades?limite=30${termo ? `&q=${encodeURIComponent(termo)}` : ''}${soArea && areaId ? `&area_id=${areaId}` : ''}`),
  });
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ID ou nome da atividade do cronograma" aria-label="Buscar atividade do cronograma"
          className="h-9 min-w-0 flex-1 rounded-[8px] border border-m-stroke bg-m-surface-field px-2.5 text-[13px]" />
        {areaId ? <label className="flex items-center gap-1 whitespace-nowrap text-[12px] text-m-text-secondary"><input type="checkbox" checked={soArea} onChange={(e) => setSoArea(e.target.checked)} /> só da área</label> : null}
      </div>
      {(r.data?.length ?? 0) > 0 && (
        <ul className="max-h-[240px] overflow-y-auto rounded-[8px] border border-m-stroke-subtle bg-m-surface-raised">
          {r.data!.map((a) => (
            <li key={a.id_crono}>
              <button type="button" onClick={() => onEscolher(a)} className="flex w-full flex-col items-start border-b border-m-stroke-subtle px-2.5 py-1.5 text-left text-[12.5px] last:border-0 hover:bg-m-surface-hover">
                <span><b>{a.id_crono}</b> · {a.atividade}</span>
                <span className="text-[11px] text-m-text-muted">{[dBR(a.inicio) && `${dBR(a.inicio)} → ${dBR(a.fim)}`, a.status, a.wbs].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {r.data && !r.data.length && <span className="text-[12px] text-m-text-muted">Nenhuma atividade encontrada.</span>}
    </div>
  );
}

/**
 * Associar a linha da programação a uma atividade do cronograma sem sair da programação (spec 080). Com IWP/etapa da
 * WBS, a WBS e as outras programações em rascunho daquele nó recebem a mesma atividade.
 */
export function AssociarAtividadeLinha({ pid, linha, onFeito }: {
  pid: number; linha: { id: number; id_crono: string | null; atividade_crono: string | null; area_id: number; wbs_no_id?: number | null }; onFeito?: () => void;
}) {
  const api = useApi();
  const [aberto, setAberto] = useState(false);
  const [naWbs, setNaWbs] = useState(true);
  const salvar = async (id: string | null) => {
    try {
      const r = await api.put<{ outras_linhas: number }>(`/programacoes/${pid}/linhas/${linha.id}/atividade`, { id_crono: id, tambem_na_wbs: naWbs });
      toast.success(id ? `Ligada a ${id}${naWbs && linha.wbs_no_id ? ' (também na WBS)' : ''}${r.outras_linhas ? ` · ${r.outras_linhas} linha(s) em outras programações` : ''}` : 'Atividade desligada');
      setAberto(false); onFeito?.();
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} title={linha.id_crono ? 'Trocar a atividade do cronograma' : 'Associar a uma atividade do cronograma'}
        className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-m-accent hover:underline"><Link2 size={11} />{linha.id_crono ? 'trocar ID' : 'associar ID do cronograma'}</button>
      {aberto && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Associar atividade do cronograma">
          <div className="flex w-full max-w-[560px] flex-col gap-3 rounded-m-lg bg-m-surface-raised p-4 shadow-m-md">
            <div className="flex items-start justify-between gap-2">
              <div><b className="text-[15px]">Atividade do cronograma</b>
                <div className="text-[12.5px] text-m-text-muted">{linha.id_crono ? `Ligada a ${linha.id_crono}${linha.atividade_crono ? ` · ${linha.atividade_crono}` : ''}` : 'Sem atividade ligada'}</div></div>
              <button type="button" aria-label="Fechar" onClick={() => setAberto(false)} className="grid h-8 w-8 place-items-center rounded-full border border-m-stroke"><X size={15} /></button>
            </div>
            <BuscaAtividadeCrono areaId={linha.area_id} autoFocus onEscolher={(a) => salvar(a.id_crono)} />
            {linha.wbs_no_id ? <label className="flex items-center gap-2 text-[12.5px] text-m-text-secondary"><input type="checkbox" checked={naWbs} onChange={(e) => setNaWbs(e.target.checked)} /> Gravar também na WBS (e nas programações em rascunho deste IWP)</label> : null}
            <div className="flex justify-end gap-2">
              {linha.id_crono && <Botao variante="secundario" onClick={() => salvar(null)}>Desligar</Botao>}
              <Botao variante="secundario" onClick={() => setAberto(false)}>Fechar</Botao>
            </div>
          </div>
        </div>, document.body)}
    </>
  );
}
