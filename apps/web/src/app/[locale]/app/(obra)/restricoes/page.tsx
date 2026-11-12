'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Check, Download, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Fragment, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Calculado } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { BarrasH, COR_STATUS, COR_STATUS1, Cartao, Colunas, Rosca } from '@/components/Obra/GraficosRestricoes';
import { Botao, Cabecalho, Campo, Chip, Indicador, Painel, Pilula, Selecao, UploadForm, dataBR, fmt } from '@/components/Obra/ui';
import { useEquipes } from '@/hooks/programacao/queries';
import { useAcao, useFrentes2 } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import type { AcaoRestricao, Ishikawa } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

const SEIS_M: Record<string, string> = { MDO: 'Mão de Obra', MET: 'Método', MAT: 'Material', MAQ: 'Máquina', MAB: 'Meio Ambiente', MED: 'Medida' };
const TOM = { Atrasado: 'perigo', Reprogramado: 'atencao', 'No Prazo': 'sucesso', 'Concluído': 'info', Cancelado: 'neutro' } as const;
const ESTADOS = ['Atrasado', 'Reprogramado', 'No Prazo', 'Concluído', 'Cancelado'] as const;
const hojeCurto = () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/** Linha em edição na tabela (nova ou existente). Observação: o histórico fica; a nota nova entra com a data de hoje. */
interface Edicao {
  id: number | null; acao: string; atividade: string; impeditivo: string; area_id: string; area_texto: string; referencia: string;
  responsavel: string; gerencia: string; prazo_inicio: string; prazo_termino: string; status1: string; seis_m: string;
  nova_observacao: string; historico: string | null; linha_id: string; equipe_id: string; reuniao: string;
}
const NOVA: Edicao = { id: null, acao: '', atividade: '', impeditivo: 'true', area_id: '', area_texto: '', referencia: '', responsavel: '', gerencia: '',
  prazo_inicio: '', prazo_termino: '', status1: 'Pendente', seis_m: '', nova_observacao: '', historico: null, linha_id: '', equipe_id: '', reuniao: '6WLA' };
const daAcao = (a: AcaoRestricao): Edicao => ({ id: a.id, acao: a.acao, atividade: a.atividade ?? '', impeditivo: a.impeditivo == null ? '' : String(a.impeditivo),
  area_id: a.area_id ? String(a.area_id) : '', area_texto: a.area_texto ?? '', referencia: a.referencia ?? '', responsavel: a.responsavel ?? '',
  gerencia: a.gerencia ?? '', prazo_inicio: a.prazo_inicio ?? '', prazo_termino: a.prazo_termino ?? '', status1: a.status1, seis_m: a.seis_m ?? '',
  nova_observacao: '', historico: a.observacoes, linha_id: a.linha_id ? String(a.linha_id) : '', equipe_id: a.equipe_id ? String(a.equipe_id) : '', reuniao: a.reuniao });
const corpo = (f: Edicao) => ({
  acao: f.acao, atividade: f.atividade || null, impeditivo: f.impeditivo === '' ? null : f.impeditivo === 'true',
  area_id: f.area_id ? Number(f.area_id) : null, area_texto: f.area_texto || null, referencia: f.referencia || null, reuniao: f.reuniao || '6WLA',
  responsavel: f.responsavel || null, gerencia: f.gerencia || null, prazo_inicio: f.prazo_inicio || null, prazo_termino: f.prazo_termino || null,
  status1: f.status1, seis_m: f.seis_m || null, nova_observacao: f.nova_observacao || null,
  linha_id: f.linha_id ? Number(f.linha_id) : null, equipe_id: f.equipe_id ? Number(f.equipe_id) : null,
});

const inp = 'h-8 w-full rounded-[8px] border border-m-stroke bg-m-surface-field px-2 text-[12.5px] text-m-text-primary outline-none focus:border-m-accent';
const th = 'whitespace-nowrap border-b border-m-stroke-subtle px-2 pb-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted';

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
  const salvar = useAcao((a, f: Edicao) => (f.id ? a.put<AcaoRestricao>(`/restricoes/${f.id}`, corpo(f)) : a.post<AcaoRestricao>('/restricoes', corpo(f))), inv);
  const reprogramar = useAcao((a, d: { id: number; data: string; observacao: string }) => a.post(`/restricoes/${d.id}/reprogramar`, d), inv);
  const excluir = useAcao((a, id: number) => a.del(`/restricoes/${id}`), inv);
  const [aba, setAba] = useState<'acoes' | 'painel' | 'importar'>('acoes');
  const [ed, setEd] = useState<Edicao | null>(null);
  const [repro, setRepro] = useState<{ id: number; data: string; observacao: string } | null>(null);
  const [filtro, setFiltro] = useState<{ estado: string; seis_m: string; gerencia: string; q: string }>({ estado: 'abertas', seis_m: '', gerencia: '', q: '' });

  // vindo do cartão do look-ahead: nova linha já com área, equipe e linha da programação
  useEffect(() => {
    if (params.get('area_id') || params.get('linha_id')) {
      setAba('acoes');
      setEd({ ...NOVA, area_id: params.get('area_id') ?? '', equipe_id: params.get('equipe_id') ?? '', linha_id: params.get('linha_id') ?? '',
        referencia: params.get('ref') ?? '', prazo_termino: params.get('ate') ?? '' });
    }
  }, [params]);

  const areas = useMemo(() => (frentes.data ?? []).flatMap((l) => l.areas), [frentes.data]);
  const gerencias = useMemo(() => [...new Set((lista.data ?? []).map((a) => a.gerencia).filter(Boolean))] as string[], [lista.data]);
  const atividades = useMemo(() => [...new Set((lista.data ?? []).map((a) => a.atividade).filter(Boolean))] as string[], [lista.data]);
  const visiveis = (lista.data ?? []).filter((a) =>
    (filtro.estado === 'todas' || (filtro.estado === 'abertas' ? a.status1 === 'Pendente' : a.status2 === filtro.estado))
    && (!filtro.seis_m || (filtro.seis_m === 'NC' ? !a.seis_m : a.seis_m === filtro.seis_m))
    && (!filtro.gerencia || a.gerencia === filtro.gerencia)
    && (!filtro.q || `${a.numero} ${a.acao} ${a.area_texto ?? ''} ${a.responsavel ?? ''} ${a.atividade ?? ''} ${a.observacoes ?? ''}`.toLowerCase().includes(filtro.q.toLowerCase())));
  const i = ish.data;
  const mem = i?.memorias ?? {};
  const conta = (chave: string, texto: ReactNode) => (mem[chave] ? <Calculado chave={chave} memoria={() => mem[chave]}>{texto}</Calculado> : texto);
  const gravar = (f: Edicao, msg = 'Restrição salva') => salvar.mutate(f, {
    onSuccess: () => { toast.success(msg); setEd(null); },
    onError: (e) => toast.error(e.message),
  });
  const rapido = (a: AcaoRestricao, campo: Partial<Edicao>, msg: string) => gravar({ ...daAcao(a), ...campo }, msg);
  const podeEditar = pode('encarregado');

  /** Linha da tabela em edição (nova ou existente): os campos ficam nas próprias colunas. */
  const linhaEdicao = (f: Edicao) => (
    <tr className="border-b border-m-row bg-m-accent-subtle/40 align-top">
      <td className="px-2 py-2 font-semibold text-m-text-primary">{f.id ? (lista.data?.find((x) => x.id === f.id)?.numero ?? '') : 'nova'}</td>
      <td className="min-w-[130px] px-1 py-1.5"><input aria-label="Atividade" list="atividades" className={inp} value={f.atividade} onChange={(e) => setEd({ ...f, atividade: e.target.value })} placeholder="Planejamento…" /></td>
      <td className="px-1 py-1.5"><select aria-label="Impeditivo" className={inp} value={f.impeditivo} onChange={(e) => setEd({ ...f, impeditivo: e.target.value })}><option value="true">SIM</option><option value="false">NÃO</option><option value="">—</option></select></td>
      <td className="min-w-[260px] px-1 py-1.5"><textarea aria-label="Ação" autoFocus required rows={3} className={`${inp} h-auto py-1.5`} value={f.acao} onChange={(e) => setEd({ ...f, acao: e.target.value })} placeholder="Descreva a ação" /></td>
      <td className="px-2 py-2 text-m-text-muted">auto</td>
      <td className="min-w-[170px] px-1 py-1.5">
        <select aria-label="Área" className={inp} value={f.area_id} onChange={(e) => setEd({ ...f, area_id: e.target.value })}>
          <option value="">— texto livre —</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.descricao}</option>)}
        </select>
        {!f.area_id && <input aria-label="Área (texto)" className={`${inp} mt-1`} value={f.area_texto} onChange={(e) => setEd({ ...f, area_texto: e.target.value })} placeholder="ex.: CMD" />}
        <select aria-label="Equipe" className={`${inp} mt-1`} value={f.equipe_id} onChange={(e) => setEd({ ...f, equipe_id: e.target.value })}>
          <option value="">equipe (opcional)</option>{equipes.data?.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </td>
      <td className="min-w-[120px] px-1 py-1.5"><input aria-label="Responsável" className={inp} value={f.responsavel} onChange={(e) => setEd({ ...f, responsavel: e.target.value })} /></td>
      <td className="min-w-[110px] px-1 py-1.5"><input aria-label="Gerência" list="gerencias" className={inp} value={f.gerencia} onChange={(e) => setEd({ ...f, gerencia: e.target.value })} /></td>
      <td className="min-w-[132px] px-1 py-1.5">
        <input aria-label="Prazo início" type="date" className={inp} value={f.prazo_inicio} onChange={(e) => setEd({ ...f, prazo_inicio: e.target.value })} />
        <input aria-label="Prazo término" type="date" className={`${inp} mt-1`} value={f.prazo_termino} onChange={(e) => setEd({ ...f, prazo_termino: e.target.value })} />
      </td>
      <td className="px-2 py-2 text-[11px] text-m-text-muted">use <CalendarClock size={12} className="inline" /></td>
      <td className="px-1 py-1.5"><select aria-label="Status 1" className={inp} value={f.status1} onChange={(e) => setEd({ ...f, status1: e.target.value })}><option>Pendente</option><option>Concluído</option><option>Cancelado</option></select></td>
      <td className="px-1 py-1.5"><select aria-label="6M" className={inp} value={f.seis_m} onChange={(e) => setEd({ ...f, seis_m: e.target.value })}><option value="">—</option>{Object.keys(SEIS_M).map((k) => <option key={k} value={k} title={SEIS_M[k]}>{k}</option>)}</select></td>
      <td className="min-w-[240px] px-1 py-1.5">
        <div className="flex items-center gap-1"><span className="whitespace-nowrap text-[11px] font-semibold text-m-accent">{hojeCurto()}:</span>
          <input aria-label="Nova observação" className={inp} value={f.nova_observacao} onChange={(e) => setEd({ ...f, nova_observacao: e.target.value })} placeholder="nova observação (entra com a data de hoje)" /></div>
        {f.historico && <div className="mt-1 max-h-24 overflow-y-auto whitespace-pre-line text-[11px] text-m-text-muted">{f.historico}</div>}
      </td>
      <td className="whitespace-nowrap px-1 py-1.5">
        <button type="button" aria-label="Salvar" title="Salvar" disabled={salvar.isPending} className="p-1.5 text-m-accent hover:text-m-accent-strong" onClick={() => (f.acao.trim().length < 3 ? toast.error('Descreva a ação') : gravar(f))}><Save size={16} /></button>
        <button type="button" aria-label="Cancelar" title="Cancelar" className="p-1.5 text-m-text-muted hover:text-m-danger" onClick={() => setEd(null)}><X size={16} /></button>
      </td>
    </tr>
  );

  return (
    <>
      <Cabecalho eyebrow="Programar · restrições" titulo="Restrições do look-ahead (6WLA)"
        acoes={<>
          <Botao variante="secundario" onClick={() => api.download('/restricoes/excel', 'Plano_de_Acao_6WLA.xlsx').catch((e) => toast.error(e.message))}><Download size={16} /> Plano de Ação (Excel)</Botao>
          {podeEditar && <Botao onClick={() => { setAba('acoes'); setEd({ ...NOVA }); }}><Plus size={16} /> Nova restrição</Botao>}
        </>} />

      <div role="tablist" aria-label="Seções das restrições" className="flex flex-wrap gap-1 border-b border-m-stroke-subtle">
        {([['acoes', `Ações (${(lista.data ?? []).filter((a) => a.status1 === 'Pendente').length} pendentes)`], ['painel', 'Painel · Ishikawa e gráficos'], ...(pode('planejador') ? [['importar', 'Importar']] : [])] as [typeof aba, string][]).map(([k, r]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[13.5px] font-semibold ${aba === k ? 'border-m-accent text-m-accent' : 'border-transparent text-m-text-secondary hover:text-m-text-primary'}`}>{r}</button>
        ))}
      </div>

      {aba === 'acoes' && (
        <Painel titulo={`Ações (${visiveis.length})`}
          acoes={<div className="flex flex-wrap items-end gap-2">
            {(['abertas', ...ESTADOS, 'todas'] as string[]).map((s) => <Chip key={s} ativo={filtro.estado === s} onClick={() => setFiltro({ ...filtro, estado: s })}>{s === 'abertas' ? 'Pendentes' : s === 'todas' ? 'Todas' : s}</Chip>)}
          </div>}>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <Campo rotulo="Buscar" placeholder="nº, ação, área, responsável, observação" value={filtro.q} onChange={(e) => setFiltro({ ...filtro, q: e.target.value })} className="w-[300px] max-w-full" />
            <Selecao rotulo="6M" value={filtro.seis_m} onChange={(e) => setFiltro({ ...filtro, seis_m: e.target.value })}>
              <option value="">Todos</option><option value="NC">Não classificado</option>{Object.entries(SEIS_M).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
            </Selecao>
            <Selecao rotulo="Gerência" value={filtro.gerencia} onChange={(e) => setFiltro({ ...filtro, gerencia: e.target.value })}>
              <option value="">Todas</option>{gerencias.map((g) => <option key={g}>{g}</option>)}
            </Selecao>
          </div>
          <datalist id="atividades">{atividades.map((x) => <option key={x} value={x} />)}</datalist>
          <datalist id="gerencias">{gerencias.map((g) => <option key={g} value={g} />)}</datalist>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full border-collapse text-[12.5px]">
              <thead><tr>{['Nº', 'Atividade', 'Imp.', 'Ação', 'Sem.', 'Área', 'Responsável', 'Gerência', 'Prazo', 'Reprog.', 'Status', '6M', 'Observações', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {ed && ed.id === null && linhaEdicao(ed)}
                {!visiveis.length && !ed && <tr><td colSpan={14} className="py-8 text-center text-m-text-muted">{lista.isLoading ? 'Carregando…' : 'Nenhuma ação.'}</td></tr>}
                {visiveis.map((a) => (
                  <Fragment key={a.id}>
                    {ed?.id === a.id ? linhaEdicao(ed) : (
                      <tr className="border-b border-m-row align-top">
                        <td className="px-2 py-2 font-semibold text-m-text-primary">{a.numero}</td>
                        <td className="px-2 py-2 text-m-text-secondary">{a.atividade ?? '—'}</td>
                        <td className="px-2 py-2">{a.impeditivo == null ? '—' : a.impeditivo ? <b className="text-m-warning">SIM</b> : 'NÃO'}</td>
                        <td className="min-w-[260px] px-2 py-2 text-m-text-primary">{a.acao}</td>
                        <td className="px-2 py-2 text-m-text-secondary">{a.semana ? `S${a.semana}` : '—'}</td>
                        <td className="px-2 py-2 text-m-text-secondary">{a.area_texto ?? '—'}</td>
                        <td className="px-2 py-2 text-m-text-secondary">{a.responsavel ?? '—'}</td>
                        <td className="px-2 py-2 text-m-text-secondary">{a.gerencia ?? '—'}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-m-text-secondary">{a.prazo_inicio ? dataBR(a.prazo_inicio).slice(0, 5) : '—'} → {a.prazo_termino ? dataBR(a.prazo_termino) : '—'}{a.conclusao && <div className="text-[11px]">concl. {dataBR(a.conclusao)}</div>}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-m-text-secondary">{a.reprogramado ? `${dataBR(a.reprogramado)} (${a.reprogramacoes})` : '—'}</td>
                        <td className="px-2 py-2"><Pilula tom={TOM[a.status2]}>{a.status2}</Pilula></td>
                        <td className="px-2 py-2">
                          {podeEditar ? (
                            <select aria-label={`6M da ação ${a.numero}`} value={a.seis_m ?? ''} onChange={(e) => rapido(a, { seis_m: e.target.value }, '6M salvo')}
                              className={`h-8 rounded-[8px] border bg-m-surface-field px-1.5 text-[12px] ${a.seis_m ? 'border-m-stroke text-m-text-primary' : 'border-m-warning text-m-warning'}`}>
                              <option value="">—</option>{Object.keys(SEIS_M).map((k) => <option key={k} value={k} title={SEIS_M[k]}>{k}</option>)}
                            </select>
                          ) : (a.seis_m ?? '—')}
                        </td>
                        <td className="min-w-[220px] max-w-[320px] px-2 py-2"><div className="max-h-20 overflow-y-auto whitespace-pre-line text-[11.5px] text-m-text-secondary">{a.observacoes ?? '—'}</div></td>
                        <td className="whitespace-nowrap px-1 py-1.5">
                          {podeEditar && <>
                            <button type="button" aria-label={`Editar a ação ${a.numero}`} title="Editar na linha" className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => { setRepro(null); setEd(daAcao(a)); }}><Pencil size={15} /></button>
                            {a.status1 === 'Pendente' && <>
                              <button type="button" aria-label={`Reprogramar a ação ${a.numero}`} title="Reprogramar" className="p-1.5 text-m-text-muted hover:text-m-warning" onClick={() => setRepro(repro?.id === a.id ? null : { id: a.id, data: '', observacao: '' })}><CalendarClock size={15} /></button>
                              <button type="button" aria-label={`Concluir a ação ${a.numero}`} title="Concluir" className="p-1.5 text-m-text-muted hover:text-m-success" onClick={() => rapido(a, { status1: 'Concluído' }, `Ação ${a.numero} concluída`)}><Check size={15} /></button>
                            </>}
                          </>}
                          {pode('planejador') && <button type="button" aria-label={`Excluir a ação ${a.numero}`} className="p-1.5 text-m-text-muted hover:text-m-danger" onClick={async () => (await confirmar({ titulo: `Excluir a ação Nº ${a.numero}?`, mensagem: a.acao })) && excluir.mutate(a.id, { onError: (e) => toast.error(e.message) })}><Trash2 size={15} /></button>}
                        </td>
                      </tr>
                    )}
                    {repro?.id === a.id && (
                      <tr className="border-b border-m-row bg-m-warning-subtle/50">
                        <td colSpan={14} className="px-2 py-2">
                          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); reprogramar.mutate(repro, { onSuccess: () => { toast.success(`Ação ${a.numero} reprogramada`); setRepro(null); }, onError: (er) => toast.error(er.message) }); }}>
                            <span className="pb-2 text-[12.5px] font-semibold text-m-text-primary">Reprogramar Nº {a.numero}:</span>
                            <Campo rotulo="Nova data" type="date" required value={repro.data} onChange={(e) => setRepro({ ...repro, data: e.target.value })} />
                            <Campo rotulo={`Motivo (vai para Observações com ${hojeCurto()})`} value={repro.observacao} onChange={(e) => setRepro({ ...repro, observacao: e.target.value })} className="w-[420px] max-w-full" />
                            <Botao type="submit" disabled={reprogramar.isPending}>Reprogramar</Botao>
                            <Botao type="button" variante="secundario" onClick={() => setRepro(null)}>Cancelar</Botao>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Painel>
      )}

      {aba === 'painel' && i && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador rotulo="Pendentes" valor={fmt(i.pendentes, 0)} detalhe={`de ${i.total} ação(ões) no plano`} />
            <Indicador rotulo="Impeditivas pendentes" valor={fmt(i.impeditivas, 0)} detalhe="travam a atividade" tom={i.impeditivas ? 'atencao' : undefined} />
            <Indicador rotulo="Atrasadas" valor={conta('status:Atrasado', fmt(i.status.Atrasado ?? 0, 0))} detalhe={`${i.status.Reprogramado ?? 0} reprogramada(s)`} tom={i.status.Atrasado ? 'perigo' : undefined} />
            <Indicador rotulo="Pendentes no prazo" valor={conta('no_prazo', i.no_prazo == null ? '—' : `${fmt(i.no_prazo * 100, 1)} %`)} detalhe="no prazo ÷ pendentes" />
          </div>

          <Painel titulo="Ishikawa das restrições pendentes (6M)">
            <div className="grid items-stretch gap-0 lg:grid-cols-[1fr_180px]">
              <div className="grid grid-rows-[auto_28px_auto]">
                <div className="grid gap-3 sm:grid-cols-3">{i.espinhas.slice(0, 3).map((e) => <Espinha key={e.codigo} e={e} conta={conta} />)}</div>
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
                {i.espinhas[6] && i.espinhas[6].pendentes > 0 && <button type="button" className="rounded-m-md border border-dashed border-m-warning px-2 py-1.5 text-[12px] text-m-warning" onClick={() => { setFiltro({ ...filtro, estado: 'abertas', seis_m: 'NC' }); setAba('acoes'); }}>{i.espinhas[6].pendentes} sem 6M · classificar</button>}
              </div>
            </div>
          </Painel>

          <Painel titulo="Painel ação">
            <div className="grid gap-4 xl:grid-cols-2">
              <Cartao titulo="Status das restrições"><Rosca grupos={i.graficos.status} mem={mem} /></Cartao>
              <Cartao titulo="Status restrições por responsável (pendentes)" legenda={{ Atrasado: COR_STATUS.Atrasado, Reprogramado: COR_STATUS.Reprogramado, 'No Prazo': COR_STATUS['No Prazo'] }}>
                <BarrasH grupos={i.graficos.responsavel} mem={mem} series={['Atrasado', 'Reprogramado', 'No Prazo']} cores={COR_STATUS} />
              </Cartao>
              <Cartao titulo="Restrições por semana do projeto (pendentes)"><Colunas grupos={i.graficos.semana} mem={mem} /></Cartao>
              <Cartao titulo="Restrições por gerência"><Colunas grupos={i.graficos.gerencia} mem={mem} cor="#007680" /></Cartao>
              <Cartao titulo="Restrições por áreas / ativos" legenda={COR_STATUS1}>
                <BarrasH grupos={i.graficos.areas} mem={mem} series={['Pendente', 'Concluído', 'Cancelado']} cores={COR_STATUS1} />
              </Cartao>
              <Cartao titulo="6M´s (pendentes)"><BarrasH grupos={i.graficos.seis_m} mem={mem} /></Cartao>
            </div>
          </Painel>
        </>
      )}
      {aba === 'painel' && !i && <p className="text-sm text-m-text-muted">Carregando…</p>}

      {aba === 'importar' && pode('planejador') && (
        <Painel titulo="Importar o Plano de Ação 6WLA">
          <UploadForm accept=".xlsm,.xlsx" campos={[{ nome: 'arquivo', rotulo: 'Plano de Ação 6WLA' }]} rotulo="Importar" pendente={importar.isPending}
            onEnviar={(fd) => importar.mutate(fd, { onSuccess: (r) => { toast.success(`${r.novas} nova(s) · ${r.atualizadas} atualizada(s)`); r.avisos.slice(0, 4).forEach((a) => toast.warning(a)); setAba('acoes'); }, onError: (e) => toast.error(e.message) })} />
        </Painel>
      )}
    </>
  );
}

function Espinha({ e, conta }: { e: Ishikawa['espinhas'][number]; conta: (c: string, t: ReactNode) => ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-m-md border border-m-stroke-subtle bg-m-surface-raised px-3 py-2">
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
