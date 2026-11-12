'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Check, Download, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Calculado } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Botao, Cabecalho, Campo, Chip, Erro, Indicador, Painel, Pilula, Selecao, UploadForm, dataBR, fmt } from '@/components/Obra/ui';
import { useEquipes } from '@/hooks/programacao/queries';
import { useAcao, useFrentes2 } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import type { AcaoRestricao, Ishikawa } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

const SEIS_M: Record<string, string> = { MDO: 'Mão de Obra', MET: 'Método', MAT: 'Material', MAQ: 'Máquina', MAB: 'Meio Ambiente', MED: 'Medida' };
const TOM = { Atrasado: 'perigo', Reprogramado: 'atencao', 'No Prazo': 'sucesso', 'Concluído': 'info', Cancelado: 'neutro' } as const;
const ESTADOS = ['Atrasado', 'Reprogramado', 'No Prazo', 'Concluído', 'Cancelado'] as const;

interface Form {
  id: number | null; acao: string; atividade: string; impeditivo: string; area_id: string; area_texto: string; referencia: string;
  responsavel: string; gerencia: string; prazo_inicio: string; prazo_termino: string; status1: string; seis_m: string;
  observacoes: string; linha_id: string; equipe_id: string; reuniao: string;
}
const VAZIO: Form = { id: null, acao: '', atividade: '', impeditivo: 'true', area_id: '', area_texto: '', referencia: '', responsavel: '', gerencia: '',
  prazo_inicio: '', prazo_termino: '', status1: 'Pendente', seis_m: '', observacoes: '', linha_id: '', equipe_id: '', reuniao: '6WLA' };

export default function RestricoesPage() {
  return <Suspense fallback={<p className="text-sm text-m-text-muted">Carregando…</p>}><Restricoes /></Suspense>;
}

function Restricoes() {
  const api = useApi();
  const confirmar = useConfirmar();
  const { pode } = useObra();
  const params = useSearchParams();
  const frentes = useFrentes2();
  const equipes = useEquipes();
  const lista = useQuery({ queryKey: ['restricoes'], queryFn: () => api.get<AcaoRestricao[]>('/restricoes') });
  const ish = useQuery({ queryKey: ['restricoes', 'ishikawa'], queryFn: () => api.get<Ishikawa>('/restricoes/ishikawa') });
  const inv = [['restricoes'], ['lookahead']];
  const importar = useAcao((a, fd: FormData) => a.post<{ novas: number; atualizadas: number; avisos: string[] }>('/restricoes/importar', fd), inv);
  const salvar = useAcao((a, f: Form) => {
    const corpo = { acao: f.acao, atividade: f.atividade || null, impeditivo: f.impeditivo === '' ? null : f.impeditivo === 'true',
      area_id: f.area_id ? Number(f.area_id) : null, area_texto: f.area_texto || null, referencia: f.referencia || null, reuniao: f.reuniao || '6WLA',
      responsavel: f.responsavel || null, gerencia: f.gerencia || null, prazo_inicio: f.prazo_inicio || null, prazo_termino: f.prazo_termino || null,
      status1: f.status1, seis_m: f.seis_m || null, observacoes: f.observacoes || null,
      linha_id: f.linha_id ? Number(f.linha_id) : null, equipe_id: f.equipe_id ? Number(f.equipe_id) : null };
    return f.id ? a.put(`/restricoes/${f.id}`, corpo) : a.post('/restricoes', corpo);
  }, inv);
  const reprogramar = useAcao((a, d: { id: number; data: string; observacao: string }) => a.post(`/restricoes/${d.id}/reprogramar`, d), inv);
  const excluir = useAcao((a, id: number) => a.del(`/restricoes/${id}`), inv);
  const [form, setForm] = useState<Form | null>(null);
  const [repro, setRepro] = useState<{ id: number; numero: number; data: string; observacao: string } | null>(null);
  const [filtro, setFiltro] = useState<{ estado: string; seis_m: string; gerencia: string; q: string }>({ estado: 'abertas', seis_m: '', gerencia: '', q: '' });

  // vindo do look-ahead: abre o formulário já com área, equipe e linha
  useEffect(() => {
    if (params.get('area_id') || params.get('linha_id')) {
      setForm({ ...VAZIO, area_id: params.get('area_id') ?? '', equipe_id: params.get('equipe_id') ?? '', linha_id: params.get('linha_id') ?? '',
        referencia: params.get('ref') ?? '', prazo_termino: params.get('ate') ?? '' });
    }
  }, [params]);

  const areas = useMemo(() => (frentes.data ?? []).flatMap((l) => l.areas.map((a) => ({ ...a, local: l.descricao }))), [frentes.data]);
  const gerencias = useMemo(() => [...new Set((lista.data ?? []).map((a) => a.gerencia).filter(Boolean))] as string[], [lista.data]);
  const visiveis = (lista.data ?? []).filter((a) =>
    (filtro.estado === 'todas' || (filtro.estado === 'abertas' ? a.status1 === 'Pendente' : a.status2 === filtro.estado))
    && (!filtro.seis_m || (filtro.seis_m === 'NC' ? !a.seis_m : a.seis_m === filtro.seis_m))
    && (!filtro.gerencia || a.gerencia === filtro.gerencia)
    && (!filtro.q || `${a.numero} ${a.acao} ${a.area_texto ?? ''} ${a.responsavel ?? ''} ${a.atividade ?? ''}`.toLowerCase().includes(filtro.q.toLowerCase())));
  const i = ish.data;
  const conta = (chave: string, texto: ReactNode) => (i?.memorias[chave] ? <Calculado chave={chave} memoria={() => i.memorias[chave]}>{texto}</Calculado> : texto);
  const editar = (a: AcaoRestricao) => setForm({ id: a.id, acao: a.acao, atividade: a.atividade ?? '', impeditivo: a.impeditivo == null ? '' : String(a.impeditivo),
    area_id: a.area_id ? String(a.area_id) : '', area_texto: a.area_texto ?? '', referencia: a.referencia ?? '', responsavel: a.responsavel ?? '',
    gerencia: a.gerencia ?? '', prazo_inicio: a.prazo_inicio ?? '', prazo_termino: a.prazo_termino ?? '', status1: a.status1, seis_m: a.seis_m ?? '',
    observacoes: a.observacoes ?? '', linha_id: a.linha_id ? String(a.linha_id) : '', equipe_id: a.equipe_id ? String(a.equipe_id) : '', reuniao: a.reuniao });
  const mudarRapido = (a: AcaoRestricao, campo: Partial<Form>) => {
    const f = { ...VAZIO, acao: a.acao, atividade: a.atividade ?? '', impeditivo: a.impeditivo == null ? '' : String(a.impeditivo), area_id: a.area_id ? String(a.area_id) : '',
      area_texto: a.area_texto ?? '', referencia: a.referencia ?? '', responsavel: a.responsavel ?? '', gerencia: a.gerencia ?? '', prazo_inicio: a.prazo_inicio ?? '',
      prazo_termino: a.prazo_termino ?? '', status1: a.status1, seis_m: a.seis_m ?? '', observacoes: a.observacoes ?? '', linha_id: a.linha_id ? String(a.linha_id) : '',
      equipe_id: a.equipe_id ? String(a.equipe_id) : '', reuniao: a.reuniao, id: a.id, ...campo };
    salvar.mutate(f, { onError: (e) => toast.error(e.message) });
  };
  const maxBarra = (xs: [string, number][]) => Math.max(1, ...xs.map((x) => x[1]));

  return (
    <>
      <Cabecalho eyebrow="Programar · restrições" titulo="Restrições do look-ahead (6WLA)"
        descricao="Cada restrição é uma ação com responsável e prazo, no layout da aba Ações do Plano de Ação: o farol e o status seguem as fórmulas da planilha (atrasado quando hoje passou do término; reprogramado enquanto estiver dentro da nova data). A classificação 6M alimenta o Ishikawa. O Excel exportado é o Plano de Ação com farol e status por fórmula."
        acoes={<>
          <Botao variante="secundario" onClick={() => api.download('/restricoes/excel', 'Plano_de_Acao_6WLA.xlsx').catch((e) => toast.error(e.message))}><Download size={16} /> Plano de Ação (Excel)</Botao>
          {pode('encarregado') && <Botao onClick={() => setForm({ ...VAZIO })}><Plus size={16} /> Nova restrição</Botao>}
        </>} />

      {i && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador rotulo="Pendentes" valor={fmt(i.pendentes, 0)} detalhe={`de ${i.total} ação(ões) no plano`} />
          <Indicador rotulo="Impeditivas pendentes" valor={fmt(i.impeditivas, 0)} detalhe="travam a atividade" tom={i.impeditivas ? 'atencao' : undefined} />
          <Indicador rotulo="Atrasadas" valor={conta('status:Atrasado', fmt(i.status.Atrasado ?? 0, 0))} detalhe={`${i.status.Reprogramado ?? 0} reprogramada(s)`} tom={i.status.Atrasado ? 'perigo' : undefined} />
          <Indicador rotulo="Pendentes no prazo" valor={conta('no_prazo', i.no_prazo == null ? '—' : `${fmt(i.no_prazo * 100, 1)} %`)} detalhe="no prazo ÷ pendentes" />
        </div>
      )}

      {i && (
        <Painel titulo="Ishikawa das restrições pendentes (6M)" subtitulo="Onde estão as causas do que ainda trava o look-ahead. Clique no número para ver as ações; classifique o 6M na tabela abaixo.">
          <div className="grid items-stretch gap-0 lg:grid-cols-[1fr_180px]">
            <div className="grid grid-rows-[auto_28px_auto]">
              <div className="grid gap-3 sm:grid-cols-3">{i.espinhas.slice(0, 3).map((e) => <Espinha key={e.codigo} e={e} conta={conta} acima />)}</div>
              <div className="relative hidden sm:block"><div className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 bg-m-text-secondary" />
                {[1, 3, 5].map((n) => <div key={n} className="absolute top-0 h-full w-[2px] bg-m-text-tertiary" style={{ left: `${(n / 6) * 100}%` }} />)}</div>
              <div className="grid gap-3 sm:grid-cols-3">{i.espinhas.slice(3, 6).map((e) => <Espinha key={e.codigo} e={e} conta={conta} />)}</div>
            </div>
            <div className="mt-3 flex flex-col justify-center gap-2 lg:ml-3 lg:mt-0">
              <div className="rounded-m-md bg-m-accent-strong px-3 py-4 text-center text-m-on-accent">
                <div className="text-[11px] font-semibold uppercase tracking-[0.4px]">Efeito</div>
                <div className="text-[13px] font-semibold">Restrições pendentes</div>
                <div className="text-[26px] font-semibold">{i.pendentes}</div>
              </div>
              {i.espinhas[6] && i.espinhas[6].pendentes > 0 && <button type="button" className="rounded-m-md border border-dashed border-m-warning px-2 py-1.5 text-[12px] text-m-warning" onClick={() => setFiltro({ ...filtro, estado: 'abertas', seis_m: 'NC' })}>{conta('6m:NC', `${i.espinhas[6].pendentes} sem 6M`)} · classificar</button>}
            </div>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {([['Por status', ESTADOS.filter((s) => i.status[s]).map((s) => [s, i.status[s]] as [string, number])], ['Pendentes por gerência', i.gerencia], ['Pendentes por área', i.area]] as [string, [string, number][]][]).map(([titulo, xs]) => (
              <div key={titulo}>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">{titulo}</h3>
                <ul className="flex flex-col gap-1">{xs.map(([rot, q]) => (
                  <li key={rot} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 text-[12.5px]" title={`${rot}: ${q}`}>
                    <span className="truncate text-m-text-secondary">{rot}</span>
                    <span className="h-2.5 rounded-r-[4px] bg-m-accent" style={{ width: `${(q / maxBarra(xs)) * 100}%`, minWidth: 3 }} />
                    <b className="text-m-text-primary">{titulo === 'Por status' ? conta(`status:${rot}`, q) : q}</b>
                  </li>))}</ul>
              </div>
            ))}
          </div>
        </Painel>
      )}

      {pode('planejador') && (
        <Painel titulo="Importar o Plano de Ação 6WLA" subtitulo="Planilha .xlsm ou .xlsx com a aba Ações. Reimportar atualiza pelo Nº (não duplica).">
          <UploadForm accept=".xlsm,.xlsx" campos={[{ nome: 'arquivo', rotulo: 'Plano de Ação 6WLA' }]} rotulo="Importar" pendente={importar.isPending}
            onEnviar={(fd) => importar.mutate(fd, { onSuccess: (r) => { toast.success(`${r.novas} nova(s) · ${r.atualizadas} atualizada(s)`); r.avisos.slice(0, 4).forEach((a) => toast.warning(a)); }, onError: (e) => toast.error(e.message) })} />
        </Painel>
      )}

      {form && (
        <Painel titulo={form.id ? 'Editar restrição' : 'Nova restrição'} acoes={<Botao variante="fantasma" onClick={() => setForm(null)}><X size={16} /> Fechar</Botao>}>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" onSubmit={(e) => { e.preventDefault(); salvar.mutate(form, { onSuccess: () => { toast.success('Restrição salva'); setForm(null); } }); }}>
            <Campo rotulo="Ação" required minLength={3} value={form.acao} onChange={(e) => setForm({ ...form, acao: e.target.value })} className="md:col-span-3 xl:col-span-4" />
            <Campo rotulo="Atividade (frente de apoio)" list="atividades" placeholder="Planejamento, Implantação…" value={form.atividade} onChange={(e) => setForm({ ...form, atividade: e.target.value })} />
            <datalist id="atividades">{[...new Set((lista.data ?? []).map((a) => a.atividade).filter(Boolean))].map((x) => <option key={x!} value={x!} />)}</datalist>
            <Selecao rotulo="Impeditivo" value={form.impeditivo} onChange={(e) => setForm({ ...form, impeditivo: e.target.value })}>
              <option value="true">SIM</option><option value="false">NÃO</option><option value="">—</option>
            </Selecao>
            <Selecao rotulo="Área (frente)" value={form.area_id} onChange={(e) => setForm({ ...form, area_id: e.target.value })} className="md:col-span-2">
              <option value="">— texto livre —</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.descricao}</option>)}
            </Selecao>
            {!form.area_id && <Campo rotulo="Área (texto)" value={form.area_texto} onChange={(e) => setForm({ ...form, area_texto: e.target.value })} />}
            <Selecao rotulo="Equipe (opcional)" value={form.equipe_id} onChange={(e) => setForm({ ...form, equipe_id: e.target.value })}>
              <option value="">—</option>{equipes.data?.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Selecao>
            <Campo rotulo="ID" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
            <Selecao rotulo="6M (Ishikawa)" value={form.seis_m} onChange={(e) => setForm({ ...form, seis_m: e.target.value })}>
              <option value="">—</option>{Object.entries(SEIS_M).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
            </Selecao>
            <Campo rotulo="Responsável" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
            <Campo rotulo="Gerência" list="gerencias" value={form.gerencia} onChange={(e) => setForm({ ...form, gerencia: e.target.value })} />
            <datalist id="gerencias">{gerencias.map((g) => <option key={g} value={g} />)}</datalist>
            <Campo rotulo="Prazo · início" type="date" value={form.prazo_inicio} onChange={(e) => setForm({ ...form, prazo_inicio: e.target.value })} />
            <Campo rotulo="Prazo · término" type="date" value={form.prazo_termino} onChange={(e) => setForm({ ...form, prazo_termino: e.target.value })} />
            <Selecao rotulo="Status 1" value={form.status1} onChange={(e) => setForm({ ...form, status1: e.target.value })}>
              <option>Pendente</option><option>Concluído</option><option>Cancelado</option>
            </Selecao>
            <Campo rotulo="Reunião" value={form.reuniao} onChange={(e) => setForm({ ...form, reuniao: e.target.value })} />
            <Campo rotulo="Observações" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="md:col-span-3 xl:col-span-4" />
            {form.linha_id && <p className="self-end text-[12px] text-m-text-muted md:col-span-2">Ligada à linha {form.linha_id} da programação (veio do look-ahead).</p>}
            <div className="flex items-end gap-2 md:col-span-3 xl:col-span-6"><Botao type="submit" disabled={salvar.isPending}>Salvar</Botao><Erro erro={salvar.error} /></div>
          </form>
        </Painel>
      )}

      {repro && (
        <Painel titulo={`Reprogramar a ação Nº ${repro.numero}`} subtitulo="O prazo original fica; a nova data entra em REPROGRAMADO e o nº de reprogramações soma 1.">
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); reprogramar.mutate(repro, { onSuccess: () => { toast.success('Reprogramada'); setRepro(null); }, onError: (er) => toast.error(er.message) }); }}>
            <Campo rotulo="Nova data" type="date" required value={repro.data} onChange={(e) => setRepro({ ...repro, data: e.target.value })} />
            <Campo rotulo="Motivo (vai para Observações)" value={repro.observacao} onChange={(e) => setRepro({ ...repro, observacao: e.target.value })} className="w-[420px] max-w-full" />
            <Botao type="submit" disabled={reprogramar.isPending}>Reprogramar</Botao>
            <Botao type="button" variante="secundario" onClick={() => setRepro(null)}>Cancelar</Botao>
          </form>
        </Painel>
      )}

      <Painel titulo={`Ações (${visiveis.length})`} acoes={<div className="flex flex-wrap items-end gap-2">
        {(['abertas', ...ESTADOS, 'todas'] as string[]).map((s) => <Chip key={s} ativo={filtro.estado === s} onClick={() => setFiltro({ ...filtro, estado: s })}>{s === 'abertas' ? 'Pendentes' : s === 'todas' ? 'Todas' : s}</Chip>)}
      </div>}>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <Campo rotulo="Buscar" placeholder="nº, ação, área, responsável" value={filtro.q} onChange={(e) => setFiltro({ ...filtro, q: e.target.value })} />
          <Selecao rotulo="6M" value={filtro.seis_m} onChange={(e) => setFiltro({ ...filtro, seis_m: e.target.value })}>
            <option value="">Todos</option><option value="NC">Não classificado</option>{Object.entries(SEIS_M).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
          </Selecao>
          <Selecao rotulo="Gerência" value={filtro.gerencia} onChange={(e) => setFiltro({ ...filtro, gerencia: e.target.value })}>
            <option value="">Todas</option>{gerencias.map((g) => <option key={g}>{g}</option>)}
          </Selecao>
        </div>
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-[12.5px]">
            <thead><tr className="text-left text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted">
              {['Nº', 'Atividade', 'Imp.', 'Ação', 'Sem.', 'Área', 'Responsável', 'Gerência', 'Prazo', 'Reprog.', 'Status', '6M', ''].map((h) => <th key={h} className="whitespace-nowrap border-b border-m-stroke-subtle px-2 pb-2">{h}</th>)}
            </tr></thead>
            <tbody>
              {!visiveis.length && <tr><td colSpan={13} className="py-8 text-center text-m-text-muted">{lista.isLoading ? 'Carregando…' : 'Nenhuma ação.'}</td></tr>}
              {visiveis.map((a) => (
                <tr key={a.id} className="border-b border-m-row align-top">
                  <td className="px-2 py-2 font-semibold text-m-text-primary">{a.numero}</td>
                  <td className="px-2 py-2 text-m-text-secondary">{a.atividade ?? '—'}</td>
                  <td className="px-2 py-2">{a.impeditivo == null ? '—' : a.impeditivo ? <b className="text-m-warning">SIM</b> : 'NÃO'}</td>
                  <td className="min-w-[260px] px-2 py-2 text-m-text-primary">{a.acao}{a.observacoes && <div className="text-[11px] text-m-text-muted">{a.observacoes}</div>}</td>
                  <td className="px-2 py-2 text-m-text-secondary">{a.semana ? `S${a.semana}` : '—'}</td>
                  <td className="px-2 py-2 text-m-text-secondary">{a.area_texto ?? '—'}</td>
                  <td className="px-2 py-2 text-m-text-secondary">{a.responsavel ?? '—'}</td>
                  <td className="px-2 py-2 text-m-text-secondary">{a.gerencia ?? '—'}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-m-text-secondary">{a.prazo_inicio ? dataBR(a.prazo_inicio).slice(0, 5) : '—'} → {a.prazo_termino ? dataBR(a.prazo_termino) : '—'}{a.conclusao && <div className="text-[11px]">concl. {dataBR(a.conclusao)}</div>}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-m-text-secondary">{a.reprogramado ? `${dataBR(a.reprogramado)} (${a.reprogramacoes})` : '—'}</td>
                  <td className="px-2 py-2"><Pilula tom={TOM[a.status2]}>{a.status2}</Pilula></td>
                  <td className="px-2 py-2">
                    {pode('encarregado') ? (
                      <select aria-label={`6M da ação ${a.numero}`} value={a.seis_m ?? ''} onChange={(e) => mudarRapido(a, { seis_m: e.target.value })}
                        className={`h-8 rounded-[8px] border bg-m-surface-field px-1.5 text-[12px] ${a.seis_m ? 'border-m-stroke text-m-text-primary' : 'border-m-warning text-m-warning'}`}>
                        <option value="">—</option>{Object.keys(SEIS_M).map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    ) : (a.seis_m ?? '—')}
                  </td>
                  <td className="whitespace-nowrap px-1 py-1.5">
                    {pode('encarregado') && <>
                      <button type="button" aria-label="Editar" className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => editar(a)}><Pencil size={15} /></button>
                      {a.status1 === 'Pendente' && <>
                        <button type="button" aria-label="Reprogramar" title="Reprogramar" className="p-1.5 text-m-text-muted hover:text-m-warning" onClick={() => setRepro({ id: a.id, numero: a.numero, data: '', observacao: '' })}><CalendarClock size={15} /></button>
                        <button type="button" aria-label="Concluir" title="Concluir" className="p-1.5 text-m-text-muted hover:text-m-success" onClick={() => mudarRapido(a, { status1: 'Concluído' })}><Check size={15} /></button>
                      </>}
                    </>}
                    {pode('planejador') && <button type="button" aria-label="Excluir" className="p-1.5 text-m-text-muted hover:text-m-danger" onClick={async () => (await confirmar({ titulo: `Excluir a ação Nº ${a.numero}?`, mensagem: a.acao })) && excluir.mutate(a.id, { onError: (e) => toast.error(e.message) })}><Trash2 size={15} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Painel>
    </>
  );
}

function Espinha({ e, conta, acima }: { e: Ishikawa['espinhas'][number]; conta: (c: string, t: ReactNode) => ReactNode; acima?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-m-md border border-m-stroke-subtle bg-m-surface-raised px-3 py-2 ${acima ? '' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-primary">{e.codigo} · {e.nome}</span>
        <span className="text-[18px] font-semibold text-m-text-primary">{conta(`6m:${e.codigo ?? 'NC'}`, e.pendentes)}</span>
      </div>
      {e.atrasadas > 0 && <span className="text-[11px] font-semibold text-m-danger">{e.atrasadas} atrasada(s)</span>}
      <ul className="flex flex-col gap-0.5 text-[11.5px] text-m-text-secondary">
        {e.itens.slice(0, 3).map((x) => <li key={x.id} className="truncate" title={x.acao}>Nº {x.numero} · {x.acao}</li>)}
        {!e.itens.length && <li className="text-m-text-tertiary">nenhuma pendente</li>}
      </ul>
    </div>
  );
}
