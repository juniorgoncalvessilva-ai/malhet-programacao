'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Replace, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Botao } from '@/components/Obra/ui';
import { buscaPq } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';

type ItemPq = { item: string; descricao: string; unid: string | null; quantidade: number | null };
type Resposta = {
  antes: string | null; item_pq: string; descricao: string; tipo_criado: string | null; wbs_atualizada: boolean;
  outras_linhas: number; avisos: string[]; precisa_nova_revisao: boolean; proxima_revisao: number;
};

/**
 * Trocar o item da PQ da linha (spec 099) — também com a programação emitida. A revisão já emitida continua como foi
 * impressa; a correção sai na próxima revisão (o próprio painel oferece emitir). Concluída: só depois de Revisar.
 */
export function TrocarItemPq({ pid, linha }: {
  pid: number; linha: { id: number; item_pq: string | null; descricao_pq?: string | null; codigo_simova?: string; wbs_no_id?: number | null };
}) {
  const api = useApi();
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState('');
  const [naWbs, setNaWbs] = useState(true);
  const [feito, setFeito] = useState<Resposta | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const termo = q.trim();
  const busca = useQuery({ queryKey: ['pq', 'busca', termo], enabled: aberto && termo.length >= 2, queryFn: () => api.get<ItemPq[]>(buscaPq(termo)) });
  const fechar = () => { setAberto(false); setFeito(null); setQ(''); };

  const trocar = async (i: ItemPq) => {
    setOcupado(true);
    try {
      const r = await api.put<Resposta>(`/programacoes/${pid}/linhas/${linha.id}/item-pq`, { item_pq: i.item, tambem_na_wbs: naWbs });
      setFeito(r);
      toast.success(`Item da PQ trocado: ${r.antes ?? '—'} → ${r.item_pq}`);
    } catch (e) { toast.error((e as Error).message, { duration: 9000 }); } finally { setOcupado(false); }
  };
  // emitida: reabre e emite de novo — a próxima revisão sai com o item certo
  const emitirNova = async () => {
    setOcupado(true);
    try {
      await api.post(`/programacoes/${pid}/reabrir`);
      const r = await api.post<{ revisao: number }>(`/programacoes/${pid}/emitir`);
      toast.success(`Emitida · revisão ${r.revisao}`);
      fechar();
    } catch (e) { toast.error((e as Error).message, { duration: 9000 }); } finally { setOcupado(false); }
  };

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} title="Corrigir o item da PQ desta linha"
        className="ml-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-m-accent hover:underline print:hidden">
        <Replace size={11} aria-hidden="true" />trocar
      </button>
      {aberto && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="trocar-pq-titulo">
          <div className="flex w-full max-w-[600px] flex-col gap-3 rounded-m-lg bg-m-surface-raised p-4 shadow-m-md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <b id="trocar-pq-titulo" className="text-[15px]">Item da PQ da linha {linha.codigo_simova ?? ''}</b>
                <div className="text-[12.5px] text-m-text-muted">Hoje: <b className="text-m-text-primary">{linha.item_pq ?? 'sem item'}</b>{linha.descricao_pq ? ` · ${linha.descricao_pq}` : ''}</div>
              </div>
              <button type="button" aria-label="Fechar" onClick={fechar} className="grid h-8 w-8 place-items-center rounded-full border border-m-stroke"><X size={15} /></button>
            </div>

            {feito ? (
              <div className="flex flex-col gap-3 text-[13px]">
                <p className="flex flex-wrap items-center gap-2 rounded-m-md bg-m-success-subtle px-3 py-2 text-m-success">
                  <b>{feito.antes ?? '—'}</b> <ArrowRight size={14} aria-hidden="true" /> <b>{feito.item_pq}</b> <span className="text-m-text-secondary">· {feito.descricao}</span>
                </p>
                <ul className="list-disc pl-5 text-m-text-secondary">
                  {feito.tipo_criado && <li>O item não estava no Catálogo: entrou como atividade {feito.tipo_criado}, no mesmo grupo.</li>}
                  {feito.wbs_atualizada && <li>O IWP da WBS também foi corrigido{feito.outras_linhas ? `, com ${feito.outras_linhas} linha(s) de outras programações abertas` : ''}.</li>}
                  {feito.avisos.map((a) => <li key={a} className="text-m-warning">{a}</li>)}
                </ul>
                {feito.precisa_nova_revisao ? (
                  <div className="flex flex-col gap-2 rounded-m-md border border-m-stroke-subtle p-3">
                    <span>A <b>rev. {feito.proxima_revisao - 1}</b> emitida continua como foi impressa. Para o documento sair com o item certo, emita a <b>rev. {feito.proxima_revisao}</b>.</span>
                    <div className="flex flex-wrap gap-2">
                      <Botao disabled={ocupado} onClick={emitirNova}>Emitir rev. {feito.proxima_revisao} agora</Botao>
                      <Botao variante="secundario" onClick={fechar}>Depois (corrigir mais linhas)</Botao>
                    </div>
                  </div>
                ) : <div className="flex justify-end"><Botao variante="secundario" onClick={fechar}>Fechar</Botao></div>}
              </div>
            ) : (
              <>
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código ou descrição do item certo da PQ" aria-label="Buscar item da PQ"
                  className="h-10 rounded-[8px] border border-m-stroke bg-m-surface-field px-3 text-[13.5px]" />
                {(busca.data?.length ?? 0) > 0 && (
                  <ul className="max-h-[280px] overflow-y-auto rounded-[8px] border border-m-stroke-subtle">
                    {busca.data!.map((i) => (
                      <li key={i.item}>
                        <button type="button" disabled={ocupado || i.item === linha.item_pq} onClick={() => trocar(i)}
                          className="flex w-full items-start gap-2 border-b border-m-stroke-subtle px-3 py-2 text-left text-[12.5px] last:border-0 hover:bg-m-surface-hover disabled:opacity-50">
                          <b className="whitespace-nowrap">{i.item}</b>
                          <span className="flex-1">{i.descricao}</span>
                          <span className="whitespace-nowrap text-m-text-muted">{i.unid ?? ''}{i.item === linha.item_pq ? ' · atual' : ''}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {busca.data && !busca.data.length && <span className="text-[12px] text-m-text-muted">Nenhum item da PQ encontrado.</span>}
                {linha.wbs_no_id ? <label className="flex items-center gap-2 text-[12.5px] text-m-text-secondary"><input type="checkbox" checked={naWbs} onChange={(e) => setNaWbs(e.target.checked)} /> Corrigir também o IWP na WBS (e as linhas dele nas outras programações abertas)</label> : null}
                <p className="text-[12px] text-m-text-muted">A revisão já emitida não muda; a correção vale a partir da próxima revisão.</p>
              </>
            )}
          </div>
        </div>, document.body)}
    </>
  );
}
