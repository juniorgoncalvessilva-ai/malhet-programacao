'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
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

/** Itens não cumpridos da programação (previsto > realizado) e o motivo de cada um, no formato do Pareto semanal. */
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
  const [aberto, setAberto] = useState<number | null>(null);
  const uteis = dias.filter((d) => !['SÁB', 'DOM'].includes(d.dia));
  const novo = (): Form => ({ data: uteis[uteis.length - 1]?.data ?? dias[0]?.data ?? '', causa_id: '', descricao: '', acao: '', responsavel: '', gerencia: '', status: '1' });
  const [form, setForm] = useState<Form>(novo);
  const v = q.data;
  if (!v || (!v.itens.length && !v.outros.length)) return null;
  return (
    <Painel titulo={<span className="flex items-center gap-2"><AlertTriangle size={16} className="text-m-warning" /> Itens não cumpridos — motivo (Pareto)</span>}
      subtitulo={v.sem_causa ? `${v.sem_causa} item(ns) sem causa: registre o motivo de cada um para concluir a programação.` : 'Todos os itens não cumpridos têm causa registrada.'}>
      <ul className="flex flex-col gap-2">
        {v.itens.map((it) => (
          <li key={it.linha_id} className={`rounded-m-md border px-3 py-2 ${it.desvios.length ? 'border-m-stroke-subtle' : 'border-m-warning'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span><b className="text-m-text-primary">linha {it.n} · {it.codigo_simova}</b> {it.descricao} <span className="text-m-text-muted">· {it.area}</span></span>
              <span className="text-m-text-secondary">fez <b>{fmt(it.realizado)}</b> de {fmt(it.previsto)} · faltou <b className="text-m-warning">{fmt(it.falta)}</b></span>
            </div>
            {it.desvios.map((d) => (
              <div key={d.id} className="mt-1 flex items-start justify-between gap-2 text-[12.5px] text-m-text-secondary">
                <span>{dataBR(d.data)} · <b className="text-m-text-primary">{d.causa}</b> — {d.descricao}{d.acao ? ` · ação: ${d.acao}` : ''}{d.responsavel ? ` · ${d.responsavel}` : ''}{d.gerencia ? ` (${d.gerencia})` : ''} · {d.status_nome}</span>
                {editavel && <button type="button" aria-label="Excluir desvio" className="p-1 text-m-text-muted hover:text-m-danger" onClick={async () => (await confirmar({ titulo: 'Excluir este desvio?', mensagem: `${d.causa} — ${d.descricao}` })) && excluir.mutate(d.id)}><Trash2 size={14} /></button>}
              </div>
            ))}
            {editavel && (aberto === it.linha_id ? (
              <form className="mt-2 grid gap-2 md:grid-cols-3 xl:grid-cols-6" onSubmit={(e) => {
                e.preventDefault();
                salvar.mutate({ item: it, f: form }, { onSuccess: () => { toast.success('Desvio registrado'); setAberto(null); setForm(novo()); } });
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
                <Campo rotulo="Responsável" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
                <Campo rotulo="Gerência (contratada/cliente)" value={form.gerencia} onChange={(e) => setForm({ ...form, gerencia: e.target.value })} />
                <Selecao rotulo="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_DESVIO).map(([n, r]) => <option key={n} value={n}>{n} · {r}</option>)}
                </Selecao>
                <div className="flex items-end gap-2">
                  <Botao type="submit" disabled={salvar.isPending}>Registrar</Botao>
                  <Botao type="button" variante="fantasma" onClick={() => setAberto(null)}><X size={14} /></Botao>
                </div>
                <div className="md:col-span-3 xl:col-span-6"><Erro erro={salvar.error} /></div>
              </form>
            ) : (
              <button type="button" className="mt-1 flex items-center gap-1 text-[12.5px] font-semibold text-m-accent underline" onClick={() => { setAberto(it.linha_id); setForm(novo()); }}><Plus size={13} /> registrar motivo</button>
            ))}
          </li>
        ))}
      </ul>
      <Erro erro={excluir.error} />
    </Painel>
  );
}
