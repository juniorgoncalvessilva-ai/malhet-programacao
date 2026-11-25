'use client';

import { Camera, Download, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BotaoTextoFoto, carimbarFoto, dataHoraBR, momentoDaFoto, reduzirFoto } from '@/components/Mobile/Fotos';
import { Esqueleto } from '@/components/Obra/Esqueleto';
import { BotaoMarcar } from '@/components/Mobile/MarcarFoto';
import { portal, portalArquivo, portalBlob } from '@/lib/portal/api';

interface Frente { id: number; codigo: string; descricao: string; local: string | null }
interface ItemWbs { wbs_no_id: number; codigo: string; item_pq: string | null; cwp: string | null; grupo: string | null; descricao: string | null; descricao_pq: string | null; unidade: string | null }
interface ItemPq { item: string; descricao: string; unid: string | null }
interface Registro { id: number; area: string | null; descricao_item: string | null; descricao: string; fotos: number[] }

const campo = 'h-12 w-full rounded-[14px] border border-m-stroke bg-m-surface-field px-3 text-[16px] text-m-text-primary outline-none focus:border-m-accent-strong focus:ring-2 focus:ring-m-accent/30';
const cartao = 'flex flex-col gap-3 rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-4';
const semAcento = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Fotos da atividade pelo endereço do encarregado (spec 121): o mesmo registro do app (spec 119) — frente, item da WBS
 * (CWP e grupo) ou da PQ, o que foi feito e as fotos, carimbadas com data, hora, frente e a logo da empresa. Ele vê e
 * baixa só as fotos que registrou.
 */
export function FotosAtividade({ obra }: { obra: string | null }) {
  const [frentes, setFrentes] = useState<Frente[] | null>(null);
  const [frente, setFrente] = useState<Frente | null>(null);
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<ItemWbs[] | null>(null);
  const [filtro, setFiltro] = useState('');
  const [iwp, setIwp] = useState<ItemWbs | null>(null);
  const [usarPq, setUsarPq] = useState(false);
  const [qPq, setQPq] = useState('');
  const [achadosPq, setAchadosPq] = useState<ItemPq[]>([]);
  const [pq, setPq] = useState<ItemPq | null>(null);
  const [descricao, setDescricao] = useState('');
  const [fotos, setFotos] = useState<Blob[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [registros, setRegistros] = useState<Registro[]>([]);

  const recarregar = useCallback(() => portal<Registro[]>('/registros').then(setRegistros).catch(() => undefined), []);
  useEffect(() => { portal<Frente[]>('/frentes').then(setFrentes).catch((e) => toast.error((e as Error).message)); void recarregar(); }, [recarregar]);
  useEffect(() => {
    setItens(null); setIwp(null); setPq(null); setUsarPq(false); setFiltro('');
    if (frente) portal<{ itens: ItemWbs[] }>(`/registros/opcoes?area_id=${frente.id}`).then((r) => setItens(r.itens)).catch(() => setItens([]));
  }, [frente]);
  useEffect(() => {
    if (qPq.trim().length < 2) { setAchadosPq([]); return; }
    const t = setTimeout(() => portal<ItemPq[]>(`/pq?q=${encodeURIComponent(qPq.trim())}`).then(setAchadosPq).catch(() => setAchadosPq([])), 300);
    return () => clearTimeout(t);
  }, [qPq]);

  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const achadas = (frentes ?? []).filter((f) => termos.every((k) => semAcento(`${f.codigo} ${f.descricao} ${f.local ?? ''}`).includes(k)));
  const termosWbs = semAcento(filtro).split(/\s+/).filter(Boolean);
  const visiveis = (itens ?? []).filter((x) => termosWbs.every((k) => semAcento([x.cwp, x.grupo, x.codigo, x.item_pq, x.descricao].filter(Boolean).join(' ')).includes(k)));
  const semWbs = itens !== null && itens.length === 0;
  const peloPq = usarPq || semWbs;
  const oQue = iwp ? `${iwp.codigo} · ${iwp.descricao ?? iwp.item_pq ?? ''}` : pq ? `${pq.item} · ${pq.descricao}` : '';
  // o texto do carimbo que a pessoa vê e pode editar (spec 145); data e hora não mudam
  const textoPadrao = [frente ? `Frente: ${frente.codigo} · ${frente.descricao}` : '', oQue, descricao.trim().slice(0, 80), obra ?? ''].filter(Boolean);
  const urls = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const tirar = async (arq: File | undefined) => {
    if (!arq) return;
    try { const b = await reduzirFoto(arq); momentoDaFoto.set(b, new Date()); setFotos((f) => [...f, b]); } catch { toast.error('Não consegui ler a foto'); }
  };
  const salvar = async () => {
    if (!frente) { toast.error('Escolha a frente'); return; }
    if (descricao.trim().length < 3) { toast.error('Diga o que foi feito'); return; }
    if (!fotos.length) { toast.error('Tire ao menos uma foto'); return; }
    setSalvando(true);
    try {
      const r = await portal<Registro>('/registros', { method: 'POST', body: { area_id: frente.id, wbs_no_id: iwp?.wbs_no_id ?? null, item_pq: iwp ? null : pq?.item ?? null, descricao } });
      for (const f of fotos) {
        const fd = new FormData();
        fd.append('arquivo', await carimbarFoto(f, ['ATIVIDADE', ...textoPadrao]), 'foto.jpg');
        await portal(`/registros/${r.id}/fotos`, { method: 'POST', body: fd });
      }
      toast.success('Atividade registrada com foto');
      setDescricao(''); setFotos([]); setIwp(null); setPq(null);
      void recarregar();
    } catch (e) { toast.error((e as Error).message); } finally { setSalvando(false); }
  };

  if (frentes === null) return <Esqueleto className="h-40 w-full" />;
  return (
    <div className="flex flex-col gap-4">
      <section className={cartao} aria-label="Frente">
        <span className="text-[14px] font-semibold">1. Onde? <span className="font-normal text-m-text-muted">Frente (CWA)</span></span>
        {frente ? (
          <div className="flex items-center justify-between gap-2 rounded-[14px] border-2 border-m-accent-strong px-3.5 py-3 text-[15px]">
            <span><b>{frente.codigo}</b> · {frente.descricao}{frente.local && <span className="block text-[12px] text-m-text-muted">{frente.local}</span>}</span>
            <button type="button" className="text-[14px] font-semibold text-m-accent underline" onClick={() => setFrente(null)}>trocar</button>
          </div>
        ) : (
          <>
            <input aria-label="Buscar frente" className={campo} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código ou nome da frente" />
            <div className="flex max-h-[45vh] flex-col overflow-y-auto rounded-[14px] border border-m-stroke">
              {achadas.map((f) => (
                <button key={f.id} type="button" onClick={() => { setFrente(f); setBusca(''); }} className="flex min-h-[52px] flex-col justify-center border-b border-m-stroke-subtle px-3 py-1.5 text-left last:border-0">
                  <span className="text-[15px]"><b>{f.codigo}</b> · {f.descricao}</span>
                  {f.local && <span className="text-[12px] text-m-text-muted">{f.local}</span>}
                </button>
              ))}
              {!achadas.length && <span className="px-3 py-3 text-[14px] text-m-text-muted">Nenhuma frente com “{busca}”.</span>}
            </div>
          </>
        )}
      </section>

      {frente && (
        <section className={cartao} aria-label="O que é">
          <span className="text-[14px] font-semibold">2. O que é? <span className="font-normal text-m-text-muted">{semWbs ? 'frente sem WBS: busque o item da PQ' : 'item da WBS da frente'}</span></span>
          {itens === null && <Esqueleto className="h-24 w-full" />}
          {!peloPq && itens && itens.length > 0 && (
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Itens da WBS">
              {itens.length > 6 && (
                <label className="flex h-12 items-center gap-2 rounded-[14px] border border-m-stroke bg-m-surface-field px-3">
                  <Search size={16} className="text-m-text-muted" aria-hidden="true" />
                  <input aria-label="Filtrar itens da WBS" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder={`${itens.length} itens · filtre por CWP ou item`} className="h-full flex-1 border-0 bg-transparent p-0 text-[16px] outline-none focus:ring-0" />
                </label>
              )}
              {visiveis.map((x) => (
                <button key={x.wbs_no_id} type="button" role="radio" aria-checked={iwp?.wbs_no_id === x.wbs_no_id} onClick={() => setIwp(iwp?.wbs_no_id === x.wbs_no_id ? null : x)}
                  className={`flex flex-col rounded-[14px] px-3.5 py-2.5 text-left ${iwp?.wbs_no_id === x.wbs_no_id ? 'border-2 border-m-accent-strong bg-m-accent-subtle' : 'border border-m-stroke'}`}>
                  <span className="text-[12px] font-semibold uppercase tracking-[0.3px] text-m-success">{[x.grupo, x.cwp && `CWP ${x.cwp}`].filter(Boolean).join(' · ')}</span>
                  <span className="text-[15px] font-medium leading-5">{x.descricao ?? x.descricao_pq ?? x.item_pq}</span>
                  <span className="text-[12px] text-m-text-muted">{x.codigo}{x.unidade ? ` · ${x.unidade}` : ''}</span>
                </button>
              ))}
              <button type="button" className="text-left text-[14px] font-semibold text-m-accent underline" onClick={() => { setUsarPq(true); setIwp(null); }}>Não está na lista: buscar na PQ</button>
            </div>
          )}
          {peloPq && (
            <div className="flex flex-col gap-2">
              {pq ? (
                <div className="flex items-start justify-between gap-2 rounded-[14px] border-2 border-m-accent-strong bg-m-accent-subtle px-3.5 py-2.5 text-[15px]">
                  <span><b>{pq.item}</b> · {pq.descricao}</span>
                  <button type="button" className="shrink-0 text-[14px] font-semibold text-m-accent underline" onClick={() => setPq(null)}>trocar</button>
                </div>
              ) : (
                <>
                  <input aria-label="Buscar item da PQ" className={campo} value={qPq} onChange={(e) => setQPq(e.target.value)} placeholder="Item ou descrição (ex.: concreto)" />
                  {achadosPq.slice(0, 12).map((x) => (
                    <button key={x.item} type="button" onClick={() => setPq(x)} className="rounded-[12px] border border-m-stroke px-3 py-2 text-left text-[14px]"><b>{x.item}</b> · {x.descricao}</button>
                  ))}
                </>
              )}
              {!semWbs && <button type="button" className="text-left text-[14px] font-semibold text-m-accent underline" onClick={() => { setUsarPq(false); setPq(null); }}>Voltar para a WBS</button>}
            </div>
          )}
          <span className="text-[13px] text-m-text-muted">Se não achar, descreva só no texto abaixo.</span>
        </section>
      )}

      {frente && (
        <section className={cartao} aria-label="O que foi feito">
          <label className="flex flex-col gap-1 text-[14px] font-semibold">3. O que foi feito?
            <textarea aria-label="O que foi feito" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} rows={3}
              placeholder="Ex.: limpeza e preparo do radier" className="rounded-[14px] border border-m-stroke bg-m-surface-field p-3 text-[16px] font-normal outline-none focus:border-m-accent-strong" />
          </label>
          <label className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-[14px] border border-dashed border-m-stroke-strong px-3.5">
            <Camera size={22} className="text-m-accent" aria-hidden="true" />
            <span className="flex flex-col"><span className="text-[15px] font-medium">Foto da atividade{fotos.length ? ` · ${fotos.length}` : ''}</span><span className="text-[12px] text-m-text-muted">Com data, hora, frente e a logo · lápis marca, Aa edita o texto</span></span>
            <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Tirar foto da atividade" onChange={(e) => { void tirar(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {urls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {urls.map((u, k) => (
                <span key={u} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={`Foto ${k + 1}`} className="h-16 w-16 rounded-[10px] object-cover" />
                  <span className="absolute inset-x-0 bottom-0 truncate rounded-b-[10px] bg-black/60 px-1 text-[8px] font-semibold leading-3 text-[#FFD54F]">{dataHoraBR(momentoDaFoto.get(fotos[k]) ?? new Date())}</span>
                  <BotaoMarcar foto={fotos[k]} onMarcada={(b) => setFotos(fotos.map((f, j) => (j === k ? b : f)))} className="absolute -left-2 -top-2" />
                  <BotaoTextoFoto foto={fotos[k]} base={textoPadrao} onMudou={() => setFotos([...fotos])} className="absolute -bottom-2 -right-2" />
                  <button type="button" aria-label={`Tirar a foto ${k + 1}`} onClick={() => setFotos(fotos.filter((_, j) => j !== k))} className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-m-surface-raised shadow"><X size={14} /></button>
                </span>
              ))}
            </div>
          )}
          <button type="button" disabled={salvando} onClick={salvar} className="flex h-12 items-center justify-center gap-2 rounded-full bg-m-accent-strong text-[16px] font-semibold text-m-on-accent disabled:opacity-40">
            <Camera size={18} aria-hidden="true" />{salvando ? 'Enviando…' : 'Registrar atividade'}
          </button>
        </section>
      )}

      {registros.length > 0 && (
        <section className={cartao} aria-label="Registradas hoje">
          <span className="text-[14px] font-semibold">Registradas hoje</span>
          {registros.map((r) => (
            <div key={r.id} className="flex flex-col gap-1.5 border-b border-m-stroke-subtle pb-2.5 last:border-0 last:pb-0">
              <span className="text-[15px] font-medium leading-5">{r.descricao}</span>
              <span className="text-[12px] text-m-text-muted">{[r.area, r.descricao_item].filter(Boolean).join(' · ')}</span>
              {r.fotos.length > 0 && <div className="flex flex-wrap gap-2">{r.fotos.map((id) => <FotoDoLider key={id} id={id} />)}</div>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** Miniatura de uma foto do líder; tocar abre grande com o botão de baixar. */
function FotoDoLider({ id }: { id: number }) {
  const [mini, setMini] = useState<string | null>(null);
  const [grande, setGrande] = useState<string | null>(null);
  const [aberta, setAberta] = useState(false);
  useEffect(() => { let u: string | null = null; portalBlob(`/fotos/${id}?mini=true`).then((b) => { u = URL.createObjectURL(b); setMini(u); }).catch(() => undefined); return () => { if (u) URL.revokeObjectURL(u); }; }, [id]);
  useEffect(() => { if (aberta && !grande) portalBlob(`/fotos/${id}`).then((b) => setGrande(URL.createObjectURL(b))).catch(() => undefined); }, [aberta, grande, id]);
  const baixar = async () => {
    try {
      const { blob: b, nome: doServidor } = await portalArquivo(`/fotos/${id}?baixar=true`);
      const nome = doServidor ?? `foto-${id}.jpg`;
      const arq = new File([b], nome, { type: b.type || 'image/jpeg' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [arq] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ files: [arq] }); return; }
      const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = nome; a.click(); URL.revokeObjectURL(url);
    } catch (e) { if ((e as Error).name !== 'AbortError') toast.error('Não consegui baixar a foto'); }
  };
  if (!mini) return <span className="inline-block h-16 w-16 animate-pulse rounded-[10px] bg-m-surface-active" />;
  return (
    <>
      <button type="button" onClick={() => setAberta(true)} aria-label="Ver a foto" className="h-16 w-16 overflow-hidden rounded-[10px] border border-m-stroke-subtle">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mini} alt="Foto da atividade" className="h-full w-full object-cover" />
      </button>
      {aberta && (
        <div role="dialog" aria-label="Foto" className="fixed inset-0 z-[150] grid place-items-center bg-black/85 p-4" onClick={() => setAberta(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={grande ?? mini} alt="Foto da atividade" className="max-h-full max-w-full rounded-[10px]" />
          <button type="button" aria-label="Baixar a foto" onClick={(e) => { e.stopPropagation(); void baixar(); }} className="absolute left-4 top-4 flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-[14px] font-semibold text-white"><Download size={18} /> Baixar</button>
          <button type="button" aria-label="Fechar" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white"><X size={22} /></button>
        </div>
      )}
    </>
  );
}
