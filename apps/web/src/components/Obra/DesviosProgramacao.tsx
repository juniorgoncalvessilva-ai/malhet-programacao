'use client';

import { GerenciaResponsavel } from '@/components/Obra/GerenciaResponsavel';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Layers, List, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePreferencia } from '@/lib/preferencia';
import { toast } from 'sonner';
import { Botao, Campo, Erro, Painel, Selecao, dataBR, fmt } from '@/components/Obra/ui';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { useAcao } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import type { CausaDesvio, DesviosProgramacao, ItemNaoCumprido } from '@/lib/api/types';

export const STATUS_DESVIO = { 1: 'Pendente', 2: 'Em andamento', 3: 'Concluído' } as const;

export function useCausas() {
  const api = useApi();
  return useQuery({ queryKey: ['desvios', 'causas'], queryFn: () => api.get<CausaDesvio[]>('/desvios/causas') });
}

interface Form { data: string; causa_id: string; descricao: string; acao: string; responsavel: string; gerencia: string; status: string }

/**
 * Itens não cumpridos da programação (previsto > realizado) e o motivo de cada um, no formato do Pareto semanal.
 * Um card por vez (spec 105): o item da vez já com o formulário aberto; ao registrar, passa sozinho para o próximo sem causa.
 * Dá para pular pelos números, ver todos em lista e minimizar o bloco (fica lembrado) — o foco é a programação.
 */
export function DesviosDaProgramacao({ pid, dias, editavel }: { pid: number; dias: { data: string; dia: string }[]; editavel: boolean }) {
  const api = useApi();
  const confirmar = useConfirmar();
  const causas = useCausas();
  const q = useQuery({ queryKey: ['desvios', 'programacao', pid], queryFn: () => api.get<DesviosProgramacao>(`/desvios/programacao/${pid}`) });
  const chave = [['desvios'], ['indicadores']];
  const salvar = useAcao((a, d: { item: ItemNaoCumprido; f: Form }) => a.post('/desvios', {
    data: d.f.data, causa_id: Number(d.f.causa_id), descricao: d.f.descricao, programacao_id: pid, linha_id: d.item.linha_id,
    referencia: d.item.codigo_simova, frente: d.item.area, atividade_impactada: d.item.descricao, qtd_nao_cumprida: d.item.falta,
    acao: d.f.acao || null, responsavel: d.f.responsavel || null, gerencia: d.f.gerencia || null, status: Number(d.f.status),
  }), chave);
  const excluir = useAcao((a, id: number) => a.del(`/desvios/${id}`), chave);
  const uteis = dias.filter((d) => !['SÁB', 'DOM'].includes(d.dia));
  const novo = (): Form => ({ data: uteis[uteis.length - 1]?.data ?? dias[0]?.data ?? '', causa_id: '', descricao: '', acao: '', responsavel: '', gerencia: '', status: '1' });
  const [form, setForm] = useState<Form>(novo);
  const [minimizado, setMinimizado] = usePreferencia('malhet.programacao.pareto.minimizado', false);
  const [todos, setTodos] = usePreferencia('malhet.programacao.pareto.todos', false);
  const [atual, setAtual] = useState<number | null>(null); // linha_id do card da vez
  const v = q.data;
  const itens = v?.itens ?? [];
  const pendentes = itens.filter((it) => !it.desvios.length);
  // o card da vez: o escolhido; sem escolha, o primeiro sem causa (ou o primeiro)
  const item = itens.find((it) => it.linha_id === atual) ?? pendentes[0] ?? itens[0];
  const pos = item ? itens.indexOf(item) : -1;
  useEffect(() => { setForm(novo()); }, [item?.linha_id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!v || (!itens.length && !v.outros.length)) return null;
  const feitos = itens.length - pendentes.length;
  const ir = (k: number) => { const it = itens[(k + itens.length) % itens.length]; if (it) setAtual(it.linha_id); };
  const proximoSemCausa = (de: ItemNaoCumprido) => {
    const resto = [...itens.slice(itens.indexOf(de) + 1), ...itens.slice(0, itens.indexOf(de))];
    return resto.find((it) => !it.desvios.length);
  };

  const desvios = (it: ItemNaoCumprido) => it.desvios.map((d) => (
    <div key={d.id} className="mt-1 flex items-start justify-between gap-2 text-[12.5px] text-m-text-secondary">
      <span>{dataBR(d.data)} · <b className="text-m-text-primary">{d.causa}</b> — {d.descricao}{d.acao ? ` · ação: ${d.acao}` : ''}{d.responsavel ? ` · ${d.responsavel}` : ''}{d.gerencia ? ` (${d.gerencia})` : ''} · {d.status_nome}</span>
      {editavel && <button type="button" aria-label="Excluir desvio" className="p-1 text-m-text-muted hover:text-m-danger" onClick={async () => (await confirmar({ titulo: 'Excluir este desvio?', mensagem: `${d.causa} — ${d.descricao}` })) && excluir.mutate(d.id)}><Trash2 size={14} /></button>}
    </div>
  ));
  const cabecalhoItem = (it: ItemNaoCumprido) => (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
      <span><b className="text-m-text-primary">linha {it.n} · {it.codigo_simova}</b> {it.descricao} <span className="text-m-text-muted">· {it.area}</span></span>
      <span className="text-m-text-secondary">fez <b>{fmt(it.realizado)}</b> de {fmt(it.previsto)} · faltou <b className="text-m-warning">{fmt(it.falta)}</b></span>
    </div>
  );

  return (
    <Painel titulo={<span className="flex items-center gap-2"><AlertTriangle size={16} className="text-m-warning" /> Itens não cumpridos — motivo (Pareto)</span>}
      subtitulo={v.sem_causa ? `${v.sem_causa} item(ns) sem causa: registre o motivo de cada um para concluir a programação.` : 'Todos os itens não cumpridos têm causa registrada.'}
      acoes={<div className="flex items-center gap-2">
        {!minimizado && itens.length > 1 && <Botao variante="fantasma" className="h-8 px-3 text-[12.5px]" onClick={() => setTodos(!todos)}>{todos ? <><Layers size={14} /> Um por vez</> : <><List size={14} /> Ver todos</>}</Botao>}
        <Botao variante="secundario" className="h-8 px-3 text-[12.5px]" aria-expanded={!minimizado} onClick={() => setMinimizado(!minimizado)}>
          {minimizado ? <><ChevronDown size={15} /> Mostrar</> : <><ChevronUp size={15} /> Minimizar</>}
        </Botao>
      </div>}>
      {/* progresso: sempre à vista, mesmo minimizado */}
      <div className="flex items-center gap-3 text-[12.5px] text-m-text-secondary">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-m-surface-hover" role="progressbar" aria-valuemin={0} aria-valuemax={itens.length} aria-valuenow={feitos} aria-label="Itens com motivo">
          <div className="h-2 rounded-full bg-m-success transition-all" style={{ width: `${itens.length ? (feitos / itens.length) * 100 : 100}%` }} />
        </div>
        <span className="whitespace-nowrap"><b className="text-m-text-primary">{feitos}</b> de {itens.length} com motivo</span>
      </div>
      {!minimizado && itens.length > 0 && (todos ? (
        <ul className="flex flex-col gap-2">
          {itens.map((it) => (
            <li key={it.linha_id} className={`rounded-m-md border px-3 py-2 ${it.desvios.length ? 'border-m-stroke-subtle' : 'border-m-warning'}`}>
              {cabecalhoItem(it)}{desvios(it)}
              {editavel && <button type="button" className="mt-1 flex items-center gap-1 text-[12.5px] font-semibold text-m-accent underline" onClick={() => { setAtual(it.linha_id); setTodos(false); }}><Plus size={13} /> registrar motivo</button>}
            </li>
          ))}
        </ul>
      ) : item && (
        <div className="flex flex-col gap-3">
          {/* números dos itens: verde = com motivo, laranja = falta; clique para ir direto */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Itens não cumpridos">
            {itens.map((it, k) => (
              <button key={it.linha_id} type="button" role="tab" aria-selected={k === pos} title={`linha ${it.n} · ${it.codigo_simova} ${it.descricao}`}
                onClick={() => setAtual(it.linha_id)}
                className={`h-7 min-w-[34px] rounded-full px-2 text-[12px] font-semibold ${k === pos ? 'ring-2 ring-m-accent ring-offset-1' : ''} ${it.desvios.length ? 'bg-m-success-subtle text-m-success' : 'bg-m-warning-subtle text-m-warning'}`}>
                {it.n}
              </button>
            ))}
          </div>
          <div key={item.linha_id} className={`animate-[m-entrar_.25s_ease-out] rounded-m-lg border-2 p-4 ${item.desvios.length ? 'border-m-stroke-subtle' : 'border-m-warning'}`}>
            <div className="mb-2 flex items-center justify-between text-[11.5px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">
              <span>Item {pos + 1} de {itens.length}{item.desvios.length ? ' · com motivo' : ' · falta o motivo'}</span>
              <span className="flex gap-1">
                <button type="button" aria-label="Item anterior" onClick={() => ir(pos - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-m-stroke hover:bg-m-surface-hover"><ChevronLeft size={15} /></button>
                <button type="button" aria-label="Próximo item" onClick={() => ir(pos + 1)} className="grid h-8 w-8 place-items-center rounded-full border border-m-stroke hover:bg-m-surface-hover"><ChevronRight size={15} /></button>
              </span>
            </div>
            {cabecalhoItem(item)}
            {desvios(item)}
            {editavel && (
              <form className="mt-3 grid gap-2 border-t border-m-stroke-subtle pt-3 md:grid-cols-3 xl:grid-cols-6" onSubmit={(e) => {
                e.preventDefault();
                const prox = proximoSemCausa(item);
                salvar.mutate({ item, f: form }, { onSuccess: () => {
                  toast.success(prox ? `Motivo registrado · próximo: linha ${prox.n}` : 'Motivo registrado');
                  setForm(novo());
                  if (prox) setAtual(prox.linha_id); // o card passa para o próximo sem causa
                } });
              }}>
                <Selecao rotulo="Dia" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })}>
                  {dias.map((d) => <option key={d.data} value={d.data}>{d.dia} {dataBR(d.data).slice(0, 5)}</option>)}
                </Selecao>
                <Selecao rotulo="Classificação (causa)" required value={form.causa_id} onChange={(e) => setForm({ ...form, causa_id: e.target.value })} className="md:col-span-2">
                  <option value="">Escolha…</option>
                  {causas.data?.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                </Selecao>
                <Campo rotulo="Desvio (o que aconteceu)" required minLength={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="md:col-span-3" />
                <Campo rotulo="Ação" value={form.acao} onChange={(e) => setForm({ ...form, acao: e.target.value })} className="md:col-span-2" />
                <GerenciaResponsavel gerencia={form.gerencia} responsavel={form.responsavel} onChange={(v) => setForm({ ...form, ...v })} />
                <Selecao rotulo="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_DESVIO).map(([n, r]) => <option key={n} value={n}>{n} · {r}</option>)}
                </Selecao>
                <div className="flex items-end gap-2 md:col-span-3 xl:col-span-6">
                  <Botao type="submit" disabled={salvar.isPending}>{item.desvios.length ? 'Registrar outro motivo' : 'Registrar e ir ao próximo'}</Botao>
                  {pendentes.length > 0 && item.desvios.length > 0 && <Botao type="button" variante="secundario" onClick={() => { const p = proximoSemCausa(item); if (p) setAtual(p.linha_id); }}>Próximo sem motivo <ChevronRight size={14} /></Botao>}
                  <Erro erro={salvar.error} />
                </div>
              </form>
            )}
          </div>
        </div>
      ))}
      <Erro erro={excluir.error} />
    </Painel>
  );
}
