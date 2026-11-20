'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { dataLonga, hojeIso } from '@/components/Mobile/campo';
import { Miniatura, TirarFotos, useEnviarFoto } from '@/components/Mobile/Fotos';
import { CampoM, RodapeM, TextoM, TopoM, botaoPrimarioM, botaoSecundarioM, cartaoM } from '@/components/Mobile/ui';
import { Carregando } from '@/components/Obra/Esqueleto';
import { buscaPq, useFrentes2 } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { useRouter } from '@/i18n/navigation';
import type { ItemPqBusca } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

interface ItemWbs { wbs_no_id: number; codigo: string; item_pq: string | null; cwp: string | null; grupo: string | null; descricao: string | null; descricao_pq: string | null; unidade: string | null }
interface Registro { id: number; data: string; area: string | null; descricao_item: string | null; descricao: string; fotos: number[]; criado_por: string }

const semAcento = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function RegistrarAtividadePage() {
  return <Suspense fallback={<Carregando />}><Registrar /></Suspense>;
}

/**
 * Registrar atividade fora da programação (spec 119): a frente (CWA), o que é — o IWP da WBS daquela frente (com CWP e
 * grupo) ou, sem WBS, o item da PQ —, o que foi feito em texto livre e as fotos, carimbadas com data, hora e frente.
 * Entra no book de fotos como atividade "fora da programação".
 */
function Registrar() {
  const api = useApi();
  const qc = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();
  const { obra, pode } = useObra();
  const enviarFoto = useEnviarFoto();
  const frentes = useFrentes2();
  const data = params.get('data') ?? hojeIso();
  const areas = useMemo(() => (frentes.data ?? []).flatMap((l) => l.areas.filter((a) => a.ativo).map((a) => ({ ...a, local: `${l.codigo} · ${l.descricao}` }))), [frentes.data]);
  const [areaId, setAreaId] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [listaAberta, setListaAberta] = useState(false);
  const [iwp, setIwp] = useState<ItemWbs | null>(null);
  const [pq, setPq] = useState<ItemPqBusca | null>(null);
  const [usarPq, setUsarPq] = useState(false);
  const [qPq, setQPq] = useState('');
  const [filtroWbs, setFiltroWbs] = useState('');
  const [descricao, setDescricao] = useState('');
  const [fotos, setFotos] = useState<Blob[]>([]);
  const [salvando, setSalvando] = useState(false);

  const area = areas.find((a) => a.id === areaId);
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const achadas = areas.filter((a) => termos.every((x) => semAcento(`${a.codigo} ${a.descricao} ${a.local}`).includes(x)));
  const opcoes = useQuery({ queryKey: ['campo', 'registro', 'opcoes', areaId], enabled: !!areaId,
    queryFn: () => api.get<{ itens: ItemWbs[] }>(`/campo/registros/opcoes?area_id=${areaId}`) });
  const itensWbs = opcoes.data?.itens ?? [];
  // frente com muitos IWPs: filtra por CWP, grupo, código ou texto do item
  const termosWbs = semAcento(filtroWbs).split(/\s+/).filter(Boolean);
  const wbsVisiveis = itensWbs.filter((x) => termosWbs.every((k) => semAcento([x.cwp, x.grupo, x.codigo, x.item_pq, x.descricao, x.descricao_pq].filter(Boolean).join(' ')).includes(k)));
  const semWbs = !!opcoes.data && itensWbs.length === 0;
  const buscandoPq = usarPq || semWbs;
  const resultadosPq = useQuery({ queryKey: ['pq', 'busca', qPq], enabled: buscandoPq && qPq.trim().length >= 2,
    queryFn: () => api.get<ItemPqBusca[]>(buscaPq(qPq.trim())) });
  const registrados = useQuery({ queryKey: ['campo', 'registros', data], queryFn: () => api.get<Registro[]>(`/campo/registros?data=${data}`) });

  const escolherArea = (id: number) => { setAreaId(id); setBusca(''); setListaAberta(false); setIwp(null); setPq(null); setUsarPq(false); setFiltroWbs(''); };
  const oQue = iwp ? `${iwp.codigo} · ${iwp.descricao ?? iwp.item_pq ?? ''}` : pq ? `${pq.item} · ${pq.descricao}` : '';
  const carimbo = [area ? `Frente: ${area.codigo} · ${area.descricao}` : '', oQue, 'Fora da programação'];

  const salvar = async () => {
    if (!area) { toast.error('Escolha a frente'); return; }
    if (descricao.trim().length < 3) { toast.error('Descreva a atividade feita'); return; }
    if (!fotos.length) { toast.error('Tire ao menos uma foto da atividade'); return; }
    setSalvando(true);
    try {
      const r = await api.post<Registro>('/campo/registros', { data, area_id: area.id, wbs_no_id: iwp?.wbs_no_id ?? null, item_pq: iwp ? null : pq?.item ?? null, descricao });
      for (const f of fotos) await enviarFoto('registro', r.id, f, { data, carimbo: ['ATIVIDADE FORA DA PROGRAMAÇÃO', ...carimbo.slice(0, 2), descricao.trim().slice(0, 80)] });
      qc.invalidateQueries({ queryKey: ['campo'] });
      toast.success('Atividade registrada com foto');
      setDescricao(''); setFotos([]); setIwp(null); setPq(null);
    } catch (e) { toast.error((e as Error).message); } finally { setSalvando(false); }
  };

  return (
    <>
      <TopoM titulo="Registrar atividade" sub={`Na programação ou fora dela · ${dataLonga(data)}`} voltar="/m" />

      <section className={cartaoM} aria-label="Frente">
        <span className="text-[13px] font-medium text-m-text-secondary">1. Onde? <span className="font-normal text-m-text-muted">Frente (CWA)</span></span>
        {area ? (
          <div className="flex items-center justify-between gap-2 rounded-[14px] border border-m-accent-strong px-3.5 py-3 text-[14px]">
            <span><b>{area.codigo}</b> · {area.descricao}<span className="block text-[11.5px] text-m-text-muted">{area.local}</span></span>
            <button type="button" className="text-[13px] font-semibold text-m-accent underline" onClick={() => { setAreaId(null); setIwp(null); setPq(null); }}>trocar</button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <CampoM rotulo="Frente (CWA)" value={busca} role="combobox" aria-expanded={listaAberta} aria-controls="lista-frentes" autoComplete="off"
              onFocus={() => setListaAberta(true)} onChange={(e) => { setBusca(e.target.value); setListaAberta(true); }} placeholder="Toque para ver as frentes ou digite" />
            {listaAberta && (
              <div id="lista-frentes" role="listbox" aria-label="Frentes" className="flex max-h-[45vh] flex-col overflow-y-auto rounded-[14px] border border-m-stroke bg-m-surface-raised">
                <div className="sticky top-0 flex items-center justify-between border-b border-m-stroke-subtle bg-m-surface-raised px-3 py-2 text-[12px] text-m-text-muted">
                  <span>{achadas.length} de {areas.length} frentes</span>
                  <button type="button" className="font-semibold text-m-accent" onClick={() => setListaAberta(false)}>fechar</button>
                </div>
                {achadas.map((a) => (
                  <button key={a.id} type="button" role="option" aria-selected={false} onClick={() => escolherArea(a.id)}
                    className="flex min-h-[48px] flex-col justify-center border-b border-m-stroke-subtle px-3 py-1.5 text-left last:border-0">
                    <span className="text-[14px]"><b>{a.codigo}</b> · {a.descricao}</span>
                    <span className="text-[11.5px] text-m-text-muted">{a.local}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {area && (
        <section className={cartaoM} aria-label="O que é">
          <span className="text-[13px] font-medium text-m-text-secondary">2. O que é? <span className="font-normal text-m-text-muted">{semWbs ? 'esta frente não tem WBS: escolha o item da PQ' : 'item da WBS desta frente'}</span></span>
          {opcoes.isLoading && <Carregando />}
          {!buscandoPq && itensWbs.length > 0 && (
            <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Itens da WBS">
              {itensWbs.length > 6 && (
                <label className="flex h-12 items-center gap-2 rounded-[14px] border border-m-stroke bg-m-surface-field px-3">
                  <Search size={16} className="text-m-text-muted" aria-hidden="true" />
                  <input aria-label="Filtrar itens da WBS" value={filtroWbs} onChange={(e) => setFiltroWbs(e.target.value)} placeholder={`${itensWbs.length} itens · filtre por CWP ou item`}
                    className="h-full flex-1 border-0 bg-transparent p-0 text-[15px] outline-none focus:ring-0" />
                </label>
              )}
              {iwp && !wbsVisiveis.some((x) => x.wbs_no_id === iwp.wbs_no_id) && <span className="text-[12px] text-m-text-muted">Escolhido: {iwp.codigo}</span>}
              {wbsVisiveis.map((x) => (
                <button key={x.wbs_no_id} type="button" role="radio" aria-checked={iwp?.wbs_no_id === x.wbs_no_id} onClick={() => { setIwp(iwp?.wbs_no_id === x.wbs_no_id ? null : x); setPq(null); }}
                  className={`flex flex-col rounded-[14px] px-3.5 py-2.5 text-left ${iwp?.wbs_no_id === x.wbs_no_id ? 'border-2 border-m-accent-strong bg-m-accent-subtle' : 'border border-m-stroke'}`}>
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.3px] text-m-success">{[x.grupo, x.cwp && `CWP ${x.cwp}`].filter(Boolean).join(' · ')}</span>
                  <span className="text-[14.5px] font-medium leading-5">{x.descricao ?? x.descricao_pq ?? x.item_pq}</span>
                  <span className="text-[11.5px] text-m-text-muted">{x.codigo}{x.item_pq ? ` · PQ ${x.item_pq}` : ''}{x.unidade ? ` · ${x.unidade}` : ''}</span>
                </button>
              ))}
              {!wbsVisiveis.length && <span className="text-[13px] text-m-text-muted">Nenhum item com “{filtroWbs}”.</span>}
              <button type="button" className="mt-1 text-left text-[13px] font-semibold text-m-accent underline" onClick={() => { setUsarPq(true); setIwp(null); }}>Não está na lista: escolher o item da PQ</button>
            </div>
          )}
          {buscandoPq && (
            <div className="flex flex-col gap-1.5">
              {pq ? (
                <div className="flex items-start justify-between gap-2 rounded-[14px] border-2 border-m-accent-strong bg-m-accent-subtle px-3.5 py-2.5 text-[14px]">
                  <span><b>{pq.item}</b> · {pq.descricao}{pq.unid ? <span className="text-m-text-muted"> ({pq.unid})</span> : null}</span>
                  <button type="button" className="shrink-0 text-[13px] font-semibold text-m-accent underline" onClick={() => setPq(null)}>trocar</button>
                </div>
              ) : (
                <>
                  <label className="flex h-12 items-center gap-2 rounded-[14px] border border-m-stroke bg-m-surface-field px-3">
                    <Search size={16} className="text-m-text-muted" aria-hidden="true" />
                    <input aria-label="Buscar item da PQ" value={qPq} onChange={(e) => setQPq(e.target.value)} placeholder="Item ou descrição da PQ (ex.: concreto)" className="h-full flex-1 border-0 bg-transparent p-0 text-[15px] outline-none focus:ring-0" />
                  </label>
                  {(resultadosPq.data ?? []).slice(0, 12).map((x) => (
                    <button key={x.item} type="button" onClick={() => setPq(x)} className="flex flex-col rounded-[12px] border border-m-stroke px-3 py-2 text-left">
                      <span className="text-[13.5px]"><b>{x.item}</b> · {x.descricao}</span>
                      {x.unid && <span className="text-[11.5px] text-m-text-muted">{x.unid}</span>}
                    </button>
                  ))}
                  {qPq.trim().length >= 2 && resultadosPq.data && !resultadosPq.data.length && <span className="text-[13px] text-m-text-muted">Nada na PQ com “{qPq}”. Descreva abaixo mesmo assim.</span>}
                </>
              )}
              {!semWbs && <button type="button" className="text-left text-[13px] font-semibold text-m-accent underline" onClick={() => { setUsarPq(false); setPq(null); }}>Voltar para os itens da WBS</button>}
            </div>
          )}
          <span className="text-[12px] text-m-text-muted">Se não achar, descreva só no texto abaixo.</span>
        </section>
      )}

      {area && (
        <section className={cartaoM} aria-label="O que foi feito">
          <TextoM rotulo="3. O que foi feito?" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500}
            placeholder="Ex.: limpeza e preparo do radier para a concretagem de amanhã" />
          <TirarFotos fotos={fotos} onChange={setFotos} rotulo="Foto da atividade" dica="Sai com data, hora e frente" carimbo={[area.codigo, oQue, obra?.nome ?? '']} />
        </section>
      )}

      {(registrados.data ?? []).length > 0 && (
        <section className={cartaoM} aria-label="Registradas no dia">
          <span className="text-[13px] font-medium text-m-text-secondary">Registradas {data === hojeIso() ? 'hoje' : 'no dia'}</span>
          {registrados.data!.map((r) => (
            <div key={r.id} className="flex flex-col gap-1.5 border-b border-m-stroke-subtle pb-2.5 last:border-0 last:pb-0">
              <span className="text-[14px] font-medium leading-5">{r.descricao}</span>
              <span className="text-[12px] text-m-text-muted">{[r.area, r.descricao_item].filter(Boolean).join(' · ')}</span>
              {r.fotos.length > 0 && <div className="flex flex-wrap gap-2">{r.fotos.map((id) => <Miniatura key={id} id={id} />)}</div>}
            </div>
          ))}
        </section>
      )}

      <RodapeM>
        <button type="button" className={botaoSecundarioM} onClick={() => router.push('/m')}>Voltar</button>
        <button type="button" className={botaoPrimarioM} disabled={salvando || !pode('encarregado')} onClick={salvar}>
          <span className="inline-flex items-center gap-2"><Camera size={18} aria-hidden="true" />{salvando ? 'Salvando…' : 'Registrar atividade'}</span>
        </button>
      </RodapeM>
    </>
  );
}
