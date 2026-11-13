'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useCausas } from '@/components/Obra/DesviosProgramacao';
import { dataLonga, hojeIso, num, useDiaCampo } from '@/components/Mobile/campo';
import { Miniatura, TirarFotos, useEnviarFoto } from '@/components/Mobile/Fotos';
import { useApi } from '@/hooks/programacao/useApi';
import { Link, useRouter } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';

export default function LancarPage() {
  return <Suspense fallback={<p className="text-sm text-m-text-muted">Carregando…</p>}><Lancar /></Suspense>;
}

const CAUSAS_VISIVEIS = 8;
const passoDe = (prev: number | null) => (prev != null && prev > 0 && prev < 5 ? 0.5 : 1);

/** Lançar o dia: uma atividade por vez, quanto foi feito (stepper grande) e, se ficou abaixo, a causa do Pareto. */
function Lancar() {
  const params = useSearchParams();
  const router = useRouter();
  const api = useApi();
  const qc = useQueryClient();
  const { pode } = useObra();
  const data = params.get('data') ?? hojeIso();
  const dia = useDiaCampo(data);
  const causas = useCausas();
  const d = dia.data;
  const linhas = useMemo(() => d?.linhas ?? [], [d]);
  const [i, setI] = useState(0);
  const [valor, setValor] = useState('');
  const [causa, setCausa] = useState<number | null>(null);
  const [texto, setTexto] = useState('');
  const [todas, setTodas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [fotos, setFotos] = useState<Blob[]>([]);
  const enviarFoto = useEnviarFoto();

  // começa na linha pedida (?linha=) ou na primeira sem realizado
  useEffect(() => {
    if (!linhas.length) return;
    const pedida = Number(params.get('linha'));
    const k = pedida ? linhas.findIndex((l) => l.id === pedida) : linhas.findIndex((l) => l.realizado == null);
    setI(Math.max(0, k));
  }, [linhas, params]);
  const ln = linhas[i];
  useEffect(() => {
    if (!ln) return;
    setValor(ln.realizado != null ? String(ln.realizado) : ln.previsto != null ? String(ln.previsto) : '');
    setCausa(null); setTexto(''); setTodas(false); setFotos([]);
  }, [ln?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const editavel = !!d?.programacao?.editavel && pode('encarregado');
  const q = valor.trim() === '' ? null : Number(valor.replace(',', '.'));
  const prev = ln?.previsto ?? null;
  const pct = prev && q != null ? q / prev : null;
  const abaixo = prev != null && q != null && q < prev - 0.005;
  const passo = passoDe(prev);
  const somar = (delta: number) => setValor(String(Math.max(0, Math.round(((q ?? 0) + delta) * 100) / 100)));
  // navegar entre as atividades do dia: setas e arrastar para o lado (spec 061)
  const toque = useRef<{ x: number; y: number } | null>(null);
  const navegar = (k: number) => { if (k >= 0 && k < linhas.length) setI(k); };
  const aoTocar = (e: React.TouchEvent) => { const t = e.touches[0]; toque.current = { x: t.clientX, y: t.clientY }; };
  const aoSoltar = (e: React.TouchEvent) => {
    const ini = toque.current; toque.current = null;
    if (!ini || (e.target as HTMLElement).closest('input, textarea')) return;
    const t = e.changedTouches[0]; const dx = t.clientX - ini.x; const dy = t.clientY - ini.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) navegar(i + (dx < 0 ? 1 : -1));
  };
  const irPara = (k: number) => { if (k >= linhas.length) { router.push('/m'); toast.success('Dia lançado'); } else setI(Math.max(0, k)); };

  const salvar = async () => {
    if (!ln || !d?.programacao) return;
    if (q != null && (Number.isNaN(q) || q < 0)) { toast.error('Quantidade inválida'); return; }
    setSalvando(true);
    try {
      await api.put(`/programacoes/${d.programacao.id}/linhas/${ln.id}/valores`, { campo: 'realizado', valores: [{ data, valor: q }] });
      let desvioId: number | null = null;
      if (abaixo && causa) {
        const nome = causas.data?.find((c) => c.id === causa)?.descricao ?? 'Desvio';
        desvioId = (await api.post<{ id: number }>('/desvios', { data, causa_id: causa, descricao: texto.trim() || nome, programacao_id: d.programacao.id, linha_id: ln.id,
          referencia: ln.codigo_simova, frente: ln.area, atividade_impactada: ln.descricao, qtd_nao_cumprida: Math.round(((prev ?? 0) - (q ?? 0)) * 100) / 100, status: 1 })).id;
      }
      // foto da frente: prova do desvio, se houve; senão, da atividade naquele dia
      for (const f of fotos) await (desvioId ? enviarFoto('desvio', desvioId, f) : enviarFoto('linha', ln.id, f, { data }));
      toast.success(`${ln.codigo_simova}: ${num(q)} ${ln.unidade ?? ''} lançado`);
      qc.invalidateQueries({ queryKey: ['campo'] });
      qc.invalidateQueries({ queryKey: ['programacao'] });
      qc.invalidateQueries({ queryKey: ['desvios'] });
      irPara(i + 1);
    } catch (e) { toast.error((e as Error).message); } finally { setSalvando(false); }
  };

  const ativas = (causas.data ?? []).filter((c) => c.ativo);
  const listaCausas = todas ? ativas : ativas.slice(0, CAUSAS_VISIVEIS);

  return (
    <>
      <header className="-mx-2 flex items-center gap-2">
        <Link href="/m" aria-label="Voltar ao início" className="grid h-11 w-11 place-items-center"><ChevronLeft size={22} /></Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="text-[17px] font-semibold leading-[22px]">Lançar o dia</h1>
          <span className="truncate text-[12px] leading-4 text-m-text-muted">{ln ? `Atividade ${i + 1} de ${linhas.length} · arraste para o lado para trocar` : dataLonga(data)}</span>
        </div>
      </header>

      <nav aria-label="Dia do lançamento" className="flex items-center justify-between rounded-full border border-m-stroke bg-m-surface-raised p-1">
        <Link href={`/m/lancar?data=${d?.anterior ?? data}`} aria-label="Dia anterior" className="grid h-10 w-10 place-items-center rounded-full"><ChevronLeft size={18} /></Link>
        <span className="text-[14px] font-semibold capitalize">{dataLonga(data)}{data === hojeIso() ? ' · hoje' : ''}</span>
        <Link href={`/m/lancar?data=${d?.seguinte ?? data}`} aria-label="Dia seguinte" className="grid h-10 w-10 place-items-center rounded-full"><ChevronRight size={18} /></Link>
      </nav>

      {linhas.length > 0 && (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${linhas.length}, 1fr)` }} aria-hidden="true">
          {linhas.map((l, k) => <button key={l.id} type="button" tabIndex={-1} onClick={() => setI(k)} className={`h-1 rounded-full ${k === i ? 'bg-m-accent' : l.realizado != null ? 'bg-m-accent-strong/60' : 'bg-m-stroke'}`} />)}
        </div>
      )}

      {dia.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
      {d && !d.programacao && <p className="rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-5 text-[14px] text-m-text-secondary">Nenhuma programação emitida cobre {dataLonga(data)}.</p>}
      {d?.programacao && !linhas.length && <p className="rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-5 text-[14px] text-m-text-secondary">Nada programado {d.so_minha_equipe ? 'para a sua equipe ' : ''}neste dia.</p>}

      {ln && (
        <>
          <nav aria-label="Atividades do dia" className="flex items-center justify-between gap-2">
            <button type="button" aria-label="Atividade anterior" disabled={i === 0} onClick={() => navegar(i - 1)}
              className="flex h-11 items-center gap-1 rounded-full border border-m-stroke px-3 text-[14px] font-semibold text-m-accent disabled:opacity-35"><ChevronLeft size={20} /> Anterior</button>
            <span className="text-[13px] font-semibold tabular-nums text-m-text-secondary">{i + 1} de {linhas.length}</span>
            <button type="button" aria-label="Próxima atividade" disabled={i + 1 >= linhas.length} onClick={() => navegar(i + 1)}
              className="flex h-11 items-center gap-1 rounded-full border border-m-stroke px-3 text-[14px] font-semibold text-m-accent disabled:opacity-35">Próxima <ChevronRight size={20} /></button>
          </nav>
          <section onTouchStart={aoTocar} onTouchEnd={aoSoltar} className="flex flex-col gap-3.5 overflow-hidden rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-[18px]">
            <div className="-mx-[18px] -mt-[18px] flex flex-col gap-0.5 bg-m-accent-strong px-[18px] py-3 text-m-on-accent" aria-label="Frente da atividade">
              <span className="text-[11px] font-semibold uppercase tracking-[0.5px] opacity-80">Frente{ln.local ? ` · ${ln.local}` : ''}</span>
              <span className="text-[19px] font-bold leading-6">{ln.area}</span>
              {ln.cwp && <span className="text-[12.5px] font-medium opacity-90">CWP {ln.cwp}</span>}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-medium uppercase leading-4 tracking-[0.48px] text-m-success">{ln.grupo} · {ln.codigo_simova}</span>
              <span className="text-[17px] font-semibold leading-[22px]">{ln.descricao}</span>
              {(ln.equipe || ln.encarregado) && <span className="text-[13px] leading-[18px] text-m-text-secondary">{[ln.equipe, ln.encarregado && `Enc. ${ln.encarregado}`].filter(Boolean).join(' · ')}</span>}
              <span className="text-[13px] leading-[18px] text-m-text-secondary">Programado {data === hojeIso() ? 'hoje' : 'no dia'}: <b className="text-m-text-primary">{num(prev)} {ln.unidade ?? ''}</b>{ln.capacidade ? ` · capacidade ${num(ln.capacidade, 1)}` : ''}</span>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="qtd" className="text-[13px] font-medium leading-[18px] text-m-text-secondary">Quanto foi feito?</label>
              <div className="grid grid-cols-[56px_1fr_56px] items-center gap-2">
                <button type="button" aria-label={`Diminuir ${passo}`} disabled={!editavel} onClick={() => somar(-passo)} className="grid h-14 place-items-center rounded-[14px] border border-m-stroke text-m-accent disabled:opacity-40"><Minus size={24} /></button>
                <div className="flex h-14 items-center justify-center gap-1.5 rounded-[14px] border-2 border-m-accent-strong">
                  <input id="qtd" inputMode="decimal" disabled={!editavel} value={valor} onChange={(e) => setValor(e.target.value)} onFocus={(e) => e.target.select()}
                    className="w-[120px] border-0 bg-transparent p-0 text-center text-[32px] font-semibold leading-9 tabular-nums shadow-none outline-none ring-0 focus:outline-none focus:ring-0 disabled:opacity-60" />
                  <span className="text-[15px] text-m-text-muted">{ln.unidade ?? ''}</span>
                </div>
                <button type="button" aria-label={`Aumentar ${passo}`} disabled={!editavel} onClick={() => somar(passo)} className="grid h-14 place-items-center rounded-[14px] border border-m-stroke text-m-accent disabled:opacity-40"><Plus size={24} /></button>
              </div>
              {pct != null && (
                <>
                  <div className="flex justify-between text-[12px] leading-4">
                    <span className={`font-semibold ${abaixo ? 'text-m-warning' : 'text-m-success'}`}>{Math.round(pct * 100)}% do programado</span>
                    <span className="text-m-text-muted">{abaixo ? `faltam ${num((prev ?? 0) - (q ?? 0))} ${ln.unidade ?? ''}` : 'meta do dia cumprida'}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-m-stroke-subtle"><div className={`h-full rounded-full ${abaixo ? 'bg-m-warning' : 'bg-m-success'}`} style={{ width: `${Math.min(100, pct * 100)}%` }} /></div>
                </>
              )}
              {prev == null && <span className="text-[12px] text-m-text-muted">Sem previsto neste dia: lance só o que foi feito.</span>}
            </div>
          </section>

          {abaixo && editavel && (
            <section className="flex flex-col gap-2.5 rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-[18px]">
              <span className="text-[13px] font-medium leading-[18px] text-m-text-secondary">Por que não fechou? <span className="font-normal text-m-text-muted">Causa do Pareto</span></span>
              {ln.desvios.length > 0 && <span className="text-[12px] text-m-text-muted">Já registrado: {ln.desvios.map((x) => x.causa).join(', ')}</span>}
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Causa">
                {listaCausas.map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={causa === c.id} onClick={() => setCausa(causa === c.id ? null : c.id)}
                    className={`min-h-[40px] rounded-full px-3.5 text-left text-[14px] ${causa === c.id ? 'bg-m-accent-strong font-semibold text-m-on-accent' : 'border border-m-stroke text-m-text-primary'}`}>{c.descricao}</button>
                ))}
                {ativas.length > CAUSAS_VISIVEIS && <button type="button" onClick={() => setTodas(!todas)} className="min-h-[40px] rounded-full px-3.5 text-[14px] font-semibold text-m-accent underline">{todas ? 'menos' : `mais ${ativas.length - CAUSAS_VISIVEIS}`}</button>}
              </div>
              {causa && <input aria-label="O que aconteceu" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que aconteceu (opcional)" className="h-12 rounded-[14px] border border-m-stroke bg-m-surface-field px-3.5 text-[15px] outline-none focus:border-m-accent" />}
            </section>
          )}
          {editavel && (
            <section className="flex flex-col gap-2 rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-[18px]">
              <TirarFotos fotos={fotos} onChange={setFotos} />
              {ln.fotos.length > 0 && <div className="flex flex-wrap gap-2">{ln.fotos.map((id) => <Miniatura key={id} id={id} />)}</div>}
            </section>
          )}
          {!editavel && <p className="text-center text-[13px] text-m-text-muted">{d?.programacao?.status === 'concluida' ? 'Programação concluída: só consulta.' : 'Seu papel só consulta.'}</p>}
        </>
      )}

      {ln && (
        <div className="fixed bottom-[76px] left-1/2 z-10 grid w-full max-w-[480px] -translate-x-1/2 grid-cols-[1fr_2fr] gap-2.5 border-t border-m-stroke-subtle bg-m-surface-raised px-4 py-3">
          <button type="button" onClick={() => irPara(i + 1)} className="h-[52px] rounded-full border border-m-stroke text-[15px] font-medium">Pular</button>
          <button type="button" disabled={!editavel || salvando} onClick={salvar} className="h-[52px] rounded-full bg-m-accent-strong text-[15px] font-semibold text-m-on-accent disabled:opacity-50">{salvando ? 'Salvando…' : i + 1 < linhas.length ? 'Salvar e próximo' : 'Salvar e concluir'}</button>
        </div>
      )}
      {ln && <div className="h-20" aria-hidden="true" />}
    </>
  );
}
