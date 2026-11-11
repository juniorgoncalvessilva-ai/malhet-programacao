'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, FileCheck2, FileSpreadsheet, Pencil, Plus, Printer, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Calculado } from '@/components/Obra/Calculado';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Chip, Erro, Painel, Pilula, Selecao, dataBR, fmt } from '@/components/Obra/ui';
import { useEquipes } from '@/hooks/programacao/queries';
import { buscaAtividades, buscaPq, k, useAcao, useCadastrosSsma, useCatalogo, useFrentes2, useProgramacao } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import { comoLista, type AtividadeBusca, type ItemPqBusca, type LinhaVisao } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { MultiSelecao } from '@/components/Obra/MultiSelecao';

interface FormLinha {
  area_id: string; grupo_id: string; tipo_id: string; complemento: string; item_pq: string;
  equipe_id: string; id_crono: string; qtd_projeto: string; observacao: string;
  natureza: 'P' | 'O' | 'E'; responsavel: string; qtd_periodo: string; pto: string[];
}
const VAZIO: FormLinha = { area_id: '', grupo_id: '', tipo_id: '', complemento: '', item_pq: '', equipe_id: '', id_crono: '', qtd_projeto: '', observacao: '', natureza: 'P', responsavel: '', qtd_periodo: '', pto: [] };
const NATUREZA = { P: 'Programada', O: 'Oportunidade', E: 'Emergencial' } as const;
type Pendentes = Record<string, string>; // `${linha}|${campo}|${data}` → valor ; `${linha}|periodo` → qtd

export default function MontarPage() {
  const confirmar = useConfirmar();
  const id = Number(useParams<{ id: string }>().id);
  const api = useApi();
  const { pode } = useObra();
  const prog = useProgramacao(id);
  const frentes = useFrentes2();
  const catalogo = useCatalogo();
  const equipes = useEquipes();
  const cadastros = useCadastrosSsma();
  const ptos = (cadastros.data ?? []).filter((c) => c.tipo === 'PTO' && (c.ativo || form.pto.includes(c.codigo)));
  const [modo, setModo] = useState<'previsto' | 'realizado'>('previsto');
  const [form, setForm] = useState<FormLinha>(VAZIO);
  const [editando, setEditando] = useState<number | null>(null);
  const [aberto, setAberto] = useState(false);
  const [qPq, setQPq] = useState('');
  const [qAt, setQAt] = useState('');
  const [pend, setPend] = useState<Pendentes>({});
  const nPend = Object.keys(pend).length;
  useEffect(() => {
    if (!nPend) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [nPend]);

  const v = prog.data;
  const rascunho = v?.status === 'rascunho';
  const podeEditarValor = modo === 'realizado' ? pode('encarregado') : rascunho && pode('encarregado');
  const chave = [[...k.programacao(id)], [...k.programacoes], [...k.catalogo]];

  const salvarLinha = useAcao((a, d: FormLinha) => {
    const corpo = {
      area_id: Number(d.area_id), tipo_id: Number(d.tipo_id), complemento: d.complemento || null, item_pq: d.item_pq || null,
      equipe_id: d.equipe_id ? Number(d.equipe_id) : null, id_crono: d.id_crono || null,
      qtd_projeto: d.qtd_projeto ? Number(d.qtd_projeto) : null, observacao: d.observacao || null,
      natureza: d.natureza, responsavel: d.responsavel || null, qtd_periodo: d.qtd_periodo ? Number(d.qtd_periodo) : null,
      pto: d.pto.length ? d.pto : null,
    };
    return editando
      ? a.put<{ aviso: string | null }>(`/programacoes/${id}/linhas/${editando}`, corpo)
      : a.post<{ aviso: string | null }>(`/programacoes/${id}/linhas`, corpo);
  }, chave);
  const excluir = useAcao((a, lid: number) => a.del(`/programacoes/${id}/linhas/${lid}`), chave);
  const emitir = useAcao((a) => a.post<{ revisao: number }>(`/programacoes/${id}/emitir`), chave);
  const reabrir = useAcao((a) => a.post(`/programacoes/${id}/reabrir`), chave);
  const salvarTudo = useAcao((a, p: Pendentes) => {
    const por: Record<number, { id: number; qtd_periodo?: number | null; mudar_qtd_periodo?: boolean; previsto: { data: string; valor: number | null }[]; realizado: { data: string; valor: number | null }[] }> = {};
    for (const [chave, val] of Object.entries(p)) {
      const [lid, campo, data] = chave.split('|');
      const ln = (por[Number(lid)] ??= { id: Number(lid), previsto: [], realizado: [] });
      const num = val.trim() === '' ? null : Number(val.replace(',', '.'));
      if (campo === 'periodo') { ln.qtd_periodo = num; ln.mudar_qtd_periodo = true; } else ln[campo as 'previsto' | 'realizado'].push({ data, valor: num });
    }
    return a.put<{ alteracoes: number }>(`/programacoes/${id}/salvar`, { linhas: Object.values(por) });
  }, [[...k.programacao(id)], [...k.programacoes]]);
  const salvar = () => salvarTudo.mutate(pend, {
    onSuccess: (r) => { setPend({}); toast.success(`Programação salva (${r.alteracoes} alteraç${r.alteracoes === 1 ? 'ão' : 'ões'})`); },
    onError: (e) => toast.error(e.message),
  });
  const valorCel = (ln: LinhaVisao, campo: 'previsto' | 'realizado', di: number, data: string) =>
    pend[`${ln.id}|${campo}|${data}`] ?? (ln[campo][di] != null ? String(ln[campo][di]) : '');
  const distribuir = (ln: LinhaVisao) => {
    if (!v) return;
    const alvo = Number(pend[`${ln.id}|periodo`] ?? ln.qtd_periodo ?? 0);
    const uteis = v.dias.filter((d) => d.dia !== 'DOM');
    if (!alvo || !uteis.length) return;
    const parte = Math.floor((alvo / uteis.length) * 100) / 100;
    const novo = { ...pend };
    v.dias.forEach((d) => { novo[`${ln.id}|previsto|${d.data}`] = d.dia === 'DOM' ? '' : String(parte); });
    const resto = Math.round((alvo - parte * uteis.length) * 100) / 100;
    if (resto) novo[`${ln.id}|previsto|${uteis[uteis.length - 1].data}`] = String(Math.round((parte + resto) * 100) / 100);
    setPend(novo);
  };
  const baixarExcel = async (rev?: number) => {
    try { await api.download(`/programacoes/${id}/excel${rev != null ? `?revisao=${rev}` : ''}`, `${v?.titulo.split(' · ')[0] ?? 'Programacao'}.xlsx`); }
    catch (e) { toast.error((e as Error).message); }
  };

  const grupo = catalogo.data?.find((g) => String(g.id) === form.grupo_id);
  const tipo = grupo?.tipos.find((t) => String(t.id) === form.tipo_id);
  const area = frentes.data?.flatMap((l) => l.areas).find((a) => String(a.id) === form.area_id);
  const pqBusca = useQuery({
    queryKey: ['pq-busca', qPq, area?.tag],
    queryFn: () => api.get<ItemPqBusca[]>(buscaPq(qPq, area?.tag)),
    enabled: aberto && !tipo?.item_pq && qPq.length >= 2,
  });
  const atBusca = useQuery({
    queryKey: ['at-busca', qAt, form.area_id],
    queryFn: () => api.get<AtividadeBusca[]>(buscaAtividades(qAt, form.area_id ? Number(form.area_id) : null)),
    enabled: aberto && !!form.area_id,
  });
  const opcoesPq = useMemo(() => {
    const permitidos = tipo?.item_pq ? [tipo.item_pq] : [];
    const achados = pqBusca.data ?? [];
    return { permitidos, outros: achados.filter((x) => !permitidos.includes(x.item)) };
  }, [tipo, pqBusca.data]);

  useEffect(() => { if (tipo?.item_pq && form.item_pq !== tipo.item_pq) setForm((f) => ({ ...f, item_pq: tipo.item_pq ?? '' })); }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirNova = (areaId?: number) => { setEditando(null); setForm({ ...VAZIO, area_id: areaId ? String(areaId) : '' }); setAberto(true); };
  const abrirEdicao = (ln: LinhaVisao) => {
    const g = catalogo.data?.find((x) => x.tipos.some((t) => t.id === ln.tipo_id));
    setEditando(ln.id);
    setForm({ area_id: String(ln.area_id), grupo_id: g ? String(g.id) : '', tipo_id: String(ln.tipo_id), complemento: ln.complemento ?? '',
      item_pq: ln.item_pq ?? '', equipe_id: ln.equipe_id ? String(ln.equipe_id) : '', id_crono: ln.id_crono ?? '',
      qtd_projeto: ln.qtd_projeto != null && ln.qtd_projeto !== ln.qtd_takeoff ? String(ln.qtd_projeto) : '', observacao: ln.observacao ?? '',
      natureza: (ln.natureza ?? 'P') as FormLinha['natureza'], responsavel: ln.responsavel ?? '', qtd_periodo: ln.qtd_periodo != null ? String(ln.qtd_periodo) : '', pto: comoLista(ln.ssma?.pto) });
    setAberto(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const baixarFt = async () => {
    try {
      const n = await api.download(`/programacoes/${id}/ft`, 'FT_IMPORT_INTERMEDIARIA.xlsx');
      toast.success(`${n} linha(s) de FT geradas para o Simova`);
    } catch (e) { toast.error((e as Error).message); }
  };

  if (!v) return <p className="text-sm text-m-text-muted">{prog.isLoading ? 'Carregando…' : 'Programação não encontrada.'}</p>;
  const totalDia = v.dias.map((d, i) => v.locais.flatMap((l) => l.areas.flatMap((a) => a.linhas)).reduce((s, ln) => s + (Number(valorCel(ln, modo, i, d.data)) || 0), 0));

  return (
    <>
      <Cabecalho
        eyebrow={`Programação ${v.tipo === 'SEMANAL' ? 'semanal' : 'mensal'} · montar`}
        titulo={`${v.titulo}: ${v.linhas} linha${v.linhas === 1 ? '' : 's'}`}
        descricao={<>Local → Área → atividade (grupo, tipo e texto complementar, que gera o ID do Simova) → item da PQ. {rascunho ? 'Previsto aberto para edição.' : 'Emitida: o previsto está travado; o realizado continua aberto.'}</>}
        acoes={<>
          <Pilula tom={rascunho ? 'neutro' : 'acento'}>{rascunho ? (v.revisao ? `Reaberta · rev. ${v.revisao}` : 'Rascunho') : `Emitida · rev. ${v.revisao - 1}`}</Pilula>
          {nPend > 0 && <Botao onClick={salvar} disabled={salvarTudo.isPending}><Save size={16} /> Salvar programação ({nPend})</Botao>}
          <Link href={`/app/programacoes/${id}/imprimir`}><Botao variante="secundario"><Printer size={16} /> Imprimir</Botao></Link>
          <Botao variante="secundario" onClick={() => baixarExcel()}><FileSpreadsheet size={16} /> Excel do cliente</Botao>
          {pode('admin') && <Botao variante="secundario" onClick={baixarFt}><Download size={16} /> FT Simova</Botao>}
          {pode('planejador') && (rascunho
            ? <Botao disabled={nPend > 0} title={nPend ? 'Salve as alterações antes de emitir' : undefined} onClick={() => emitir.mutate(undefined, { onSuccess: (r) => toast.success(`Emitida · revisão ${r.revisao}`), onError: (e) => toast.error(e.message) })}><FileCheck2 size={16} /> Emitir</Botao>
            : <Botao variante="secundario" onClick={() => reabrir.mutate(undefined)}><RotateCcw size={16} /> Reabrir</Botao>)}
        </>}
      />

      {aberto && (
        <Painel titulo={editando ? 'Editar linha' : 'Nova linha'} subtitulo="O ID do Simova sai do tipo; com texto complementar vira um item novo (ex.: 2.3.1 Concreto 20 MPa - (Fundo canaleta 2A))."
          acoes={<Botao variante="fantasma" onClick={() => setAberto(false)}><X size={16} /> Fechar</Botao>}>
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={(e) => {
            e.preventDefault();
            salvarLinha.mutate(form, { onSuccess: (r) => {
              if (r.aviso) toast.warning(r.aviso); else toast.success(editando ? 'Linha atualizada' : 'Linha incluída');
              if (editando) { setAberto(false); setEditando(null); } else setForm((f) => ({ ...VAZIO, area_id: f.area_id, equipe_id: f.equipe_id }));
            } });
          }}>
            <Selecao rotulo="Área (frente)" required value={form.area_id} onChange={(e) => setForm({ ...form, area_id: e.target.value, id_crono: '' })}>
              <option value="">Escolha…</option>
              {frentes.data?.map((l) => (
                <optgroup key={l.id} label={`${l.codigo} · ${l.descricao}`}>
                  {l.areas.filter((a) => a.ativo).map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.descricao}</option>)}
                </optgroup>
              ))}
            </Selecao>
            <Selecao rotulo="Grupo" required value={form.grupo_id} onChange={(e) => setForm({ ...form, grupo_id: e.target.value, tipo_id: '', item_pq: '' })}>
              <option value="">Escolha…</option>
              {catalogo.data?.filter((g) => g.ativo).map((g) => <option key={g.id} value={g.id}>{g.codigo} · {g.descricao}</option>)}
            </Selecao>
            <Selecao rotulo="Atividade (item da PQ)" required value={form.tipo_id} onChange={(e) => setForm({ ...form, tipo_id: e.target.value, item_pq: '' })}>
              <option value="">{grupo ? 'Escolha…' : 'Escolha o grupo antes'}</option>
              {grupo?.tipos.filter((t) => t.ativo).map((t) => <option key={t.id} value={t.id}>{t.codigo} · {t.item_pq ? `${t.item_pq} · ` : ''}{t.descricao.slice(0, 90)}</option>)}
            </Selecao>
            <div>
              <Campo rotulo="Texto complementar (opcional)" list="complementos" placeholder="ex.: Fundo canaleta 2A" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
              <datalist id="complementos">{tipo?.itens.map((i) => <option key={i.id} value={i.complemento}>{i.codigo}</option>)}</datalist>
              {tipo && <p className="mt-1 text-xs text-m-text-muted">ID Simova: <b>{form.complemento.trim() ? (tipo.itens.find((i) => i.complemento.toLowerCase() === form.complemento.trim().replace(/^\(|\)$/g, '').toLowerCase())?.codigo ?? `${tipo.codigo}.novo`) : tipo.codigo}</b></p>}
            </div>
            {tipo?.item_pq ? (
              <div className="flex flex-col gap-1 rounded-m-md border border-m-stroke-subtle bg-m-surface-active px-3 py-2 text-[13px] md:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Item da PQ (mede nele)</span>
                <span><b className="text-m-text-primary">{tipo.item_pq}</b> · {tipo.descricao} · {tipo.unidade ?? ''}{tipo.quantidade_pq != null ? ` · contrato ${fmt(tipo.quantidade_pq)}` : ''}</span>
              </div>
            ) : (<>
            <Selecao rotulo="Item da PQ" value={form.item_pq} onChange={(e) => setForm({ ...form, item_pq: e.target.value })}>
                <option value="">— sem item —</option>
                {opcoesPq.permitidos.length > 0 && <optgroup label="Itens do tipo">{opcoesPq.permitidos.map((x) => {
                  const b = pqBusca.data?.find((p) => p.item === x);
                  return <option key={x} value={x}>{x}{b ? ` · ${b.descricao.slice(0, 60)}${b.qtd_tag != null ? ` · TAG ${fmt(b.qtd_tag)}` : ''}` : ''}</option>;
                })}</optgroup>}
                {opcoesPq.outros.length > 0 && <optgroup label="Busca">{opcoesPq.outros.map((x) => <option key={x.item} value={x.item}>{x.item} · {x.descricao.slice(0, 60)}{x.qtd_tag != null ? ` · TAG ${fmt(x.qtd_tag)}` : ''}</option>)}</optgroup>}
                {form.item_pq && !opcoesPq.permitidos.includes(form.item_pq) && !opcoesPq.outros.some((o) => o.item === form.item_pq) && <option value={form.item_pq}>{form.item_pq}</option>}
              </Selecao>
              <Campo rotulo="Buscar outro item da PQ" placeholder="nº ou descrição" value={qPq} onChange={(e) => setQPq(e.target.value)} />
            </>)}
            <Selecao rotulo="Equipe / encarregado" value={form.equipe_id} onChange={(e) => {
              const eq = equipes.data?.find((x) => String(x.id) === e.target.value);
              setForm({ ...form, equipe_id: e.target.value, responsavel: form.responsavel || eq?.responsavel || '' });
            }}>
              <option value="">—</option>
              {equipes.data?.filter((e) => e.ativo || String(e.id) === form.equipe_id).map((e) => <option key={e.id} value={e.id}>{e.codigo_simova ? `${e.codigo_simova} · ` : ''}{e.nome} · {e.encarregado_nome ?? 'sem encarregado'}{e.encarregado_cracha ? '' : ' (sem crachá)'} · {e.turno ?? 'Diurno'} {fmt(e.jornada_horas, 1)}h</option>)}
            </Selecao>
            <Selecao rotulo="Programada / Oportunidade / Emergencial" value={form.natureza} onChange={(e) => setForm({ ...form, natureza: e.target.value as FormLinha['natureza'] })}>
              {Object.entries(NATUREZA).map(([k2, r]) => <option key={k2} value={k2}>{k2} · {r}</option>)}
            </Selecao>
            <Campo rotulo="Responsável" placeholder="vem da equipe" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
            <div className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted" title={pode('planejador') ? undefined : 'O PTO é escolhido pelo Planejamento'}>
              PTO (Plano de Trabalho de Obra) · um ou mais
              <MultiSelecao rotulo="PTO" largura="w-full" disabled={!pode('planejador')} valor={form.pto} onChange={(v) => setForm({ ...form, pto: v })}
                onBaixar={(aid, nome) => api.download(`/ssma/anexos/${aid}`, nome).catch((e) => toast.error(e.message))}
                opcoes={ptos.map((c) => ({ valor: c.codigo, rotulo: `${c.codigo}${c.descricao ? ` · ${c.descricao.slice(0, 50)}` : ''}${c.ativo ? '' : ' (inativo)'}`, anexos: c.anexos }))} />
            </div>
            <Campo rotulo={`Previsto no período (${v.tipo === 'SEMANAL' ? 'semana' : 'mês'})`} type="number" step="any" min="0" value={form.qtd_periodo} onChange={(e) => setForm({ ...form, qtd_periodo: e.target.value })} />
            <Selecao rotulo="Atividade do cronograma (opcional)" value={form.id_crono} onChange={(e) => setForm({ ...form, id_crono: e.target.value })}>
              <option value="">{form.area_id ? '—' : 'escolha a área antes'}</option>
              {atBusca.data?.map((a) => <option key={a.id_crono} value={a.id_crono}>{a.id_crono} · {a.atividade.slice(0, 70)}</option>)}
              {form.id_crono && !atBusca.data?.some((a) => a.id_crono === form.id_crono) && <option value={form.id_crono}>{form.id_crono}</option>}
            </Selecao>
            <Campo rotulo="Filtrar atividades" placeholder="ID ou nome" value={qAt} onChange={(e) => setQAt(e.target.value)} />
            <Campo rotulo="Qtd projeto (vazio = take-off da TAG)" type="number" step="any" min="0" value={form.qtd_projeto} onChange={(e) => setForm({ ...form, qtd_projeto: e.target.value })} />
            <Campo rotulo="Observação" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="md:col-span-2" />
            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
              <Botao type="submit" disabled={salvarLinha.isPending}>{editando ? 'Salvar linha' : <><Plus size={16} /> Incluir linha</>}</Botao>
              <Erro erro={salvarLinha.error} />
            </div>
          </form>
        </Painel>
      )}

      <Painel
        titulo="O que cada frente faz no período?"
        subtitulo={`${dataBR(v.inicio)} a ${dataBR(v.fim)} · digite a quantidade do período e de cada dia e clique em Salvar programação.`}
        acoes={<>
          <Chip ativo={modo === 'previsto'} onClick={() => setModo('previsto')}>P · Previsto</Chip>
          <Chip ativo={modo === 'realizado'} onClick={() => setModo('realizado')}>R · Realizado</Chip>
          {rascunho && pode('encarregado') && !aberto && <Botao onClick={() => abrirNova()}><Plus size={16} /> Nova linha</Botao>}
        </>}
      >
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">
                <th className="px-2 pb-2 text-left">Item</th>
                <th className="px-2 pb-2 text-left">ID Simova · atividade</th>
                <th className="px-2 pb-2 text-left">PQ</th>
                <th className="px-2 pb-2 text-left">Equipe</th>
                <th className="px-2 pb-2 text-right">Projeto</th>
                <th className="px-2 pb-2 text-right">Prev. período</th>
                {v.dias.map((d) => <th key={d.data} className={`px-1 pb-2 text-center ${['SÁB', 'DOM'].includes(d.dia) ? 'text-m-text-tertiary' : ''}`}>{d.dia}<div className="font-medium normal-case">{d.data.slice(8)}/{d.data.slice(5, 7)}</div></th>)}
                <th className="px-2 pb-2 text-right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!v.locais.length && <tr><td colSpan={v.dias.length + 8} className="py-10 text-center text-m-text-muted">Inclua a primeira linha: escolha a área, o grupo e o tipo.</td></tr>}
              {v.locais.map((l, li) => (
                <Fragment key={`l${l.id}`}>
                  <tr><td colSpan={v.dias.length + 8} className="bg-m-accent-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.4px] text-m-on-accent">{l.codigo} · {l.descricao}</td></tr>
                  {l.areas.map((a, ai) => (
                    <Fragment key={`a${a.id}`}>
                      <tr>
                        <td colSpan={v.dias.length + 8} className="border-b border-m-stroke-subtle bg-m-surface-active px-3 py-1.5 text-xs font-semibold text-m-accent">
                          {a.codigo} · {a.descricao}
                          {rascunho && pode('encarregado') && <button type="button" className="ml-3 font-semibold underline" onClick={() => abrirNova(a.id)}>+ linha</button>}
                        </td>
                      </tr>
                      {a.linhas.map((ln, i) => (
                        <tr key={ln.id} className="border-b border-m-row align-top">
                          <td className="px-2 py-2 text-m-text-muted">{li + 1}.{ai + 1}.{i + 1}</td>
                          <td className="min-w-[240px] px-2 py-2">
                            <b className="text-m-text-primary">{ln.codigo_simova}</b> <span className="text-m-text-primary">{ln.descricao}</span>
                            <div className="text-xs text-m-text-muted">{ln.grupo.codigo} · {ln.grupo.descricao}{ln.id_crono ? ` · ${ln.id_crono}` : ''}{ln.observacao ? ` · ${ln.observacao}` : ''}</div>
                            <div className="text-[11px] text-m-text-muted">{NATUREZA[(ln.natureza ?? 'P') as keyof typeof NATUREZA]}{ln.turno ? ` · ${ln.turno}` : ''}{ln.jornada ? ` ${fmt(ln.jornada, 1)}h` : ''}{ln.responsavel ? ` · resp. ${ln.responsavel}` : ''}{comoLista(ln.ssma?.pto).length ? ` · PTO ${comoLista(ln.ssma?.pto).join(', ')}` : ''}</div>
                            <Calculo ln={ln} pid={id} />
                          </td>
                          <td className="px-2 py-2">{ln.item_pq ? <span title={ln.descricao_pq ?? ''}>{ln.item_pq}</span> : <span className="text-m-warning">sem PQ</span>}</td>
                          <td className="px-2 py-2">{ln.equipe ? <Calculado rota={`/programacoes/${id}/linhas/${ln.id}/memoria`} chave="composicao_equipe" titulo="Ver a composição da equipe e de onde vem a função de cada pessoa">{ln.equipe}</Calculado> : <span className="text-m-warning">sem equipe</span>}{ln.equipe && !ln.cracha && <div className="text-xs text-m-warning">sem crachá</div>}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">{ln.qtd_projeto != null ? <Calculado rota={`/programacoes/${id}/linhas/${ln.id}/memoria`} chave="qtd_projeto">{`${fmt(ln.qtd_projeto)} ${ln.unidade ?? ''}`}</Calculado> : '—'}
                            {ln.realizado_anterior ? <div className="text-[11px] text-m-text-muted">feito <Calculado rota={`/programacoes/${id}/linhas/${ln.id}/memoria`} chave="realizado_anterior">{fmt(ln.realizado_anterior)}</Calculado></div> : null}
                            {ln.restante != null ? <div className="text-[11px] text-m-text-muted">resta <Calculado rota={`/programacoes/${id}/linhas/${ln.id}/memoria`} chave="restante">{fmt(ln.restante)}</Calculado></div> : null}</td>
                          <td className="px-1 py-1.5 text-right">
                            {(() => {
                              const pv = pend[`${ln.id}|periodo`] ?? (ln.qtd_periodo != null ? String(ln.qtd_periodo) : '');
                              const soma = v.dias.reduce((s2, d, di) => s2 + (Number(valorCel(ln, 'previsto', di, d.data)) || 0), 0);
                              const difere = pv !== '' && Math.abs(Number(pv) - soma) > 0.005;
                              return <>
                                <input aria-label={`${ln.codigo_simova} previsto no período`} type="number" min="0" step="any" disabled={!(rascunho && pode('encarregado'))}
                                  value={pv} onChange={(e) => setPend({ ...pend, [`${ln.id}|periodo`]: e.target.value })}
                                  className={`h-8 w-[72px] rounded-[8px] border bg-m-surface-field px-1.5 text-right text-[13px] font-semibold outline-none focus:border-m-accent disabled:border-transparent disabled:bg-transparent ${difere ? 'border-m-warning' : 'border-m-stroke'}`} />
                                {difere && <div className="mt-0.5 text-[10px] text-m-warning">dias somam {fmt(soma)}{rascunho && pode('encarregado') && <> · <button type="button" className="font-semibold underline" onClick={() => distribuir(ln)}>distribuir</button></>}</div>}
                              </>;
                            })()}
                          </td>
                          {v.dias.map((d, di) => (
                            <td key={d.data} className="px-0.5 py-1.5">
                              <input
                                aria-label={`${ln.codigo_simova} ${d.dia} ${d.data}`}
                                type="number" min="0" step="any" disabled={!podeEditarValor}
                                value={valorCel(ln, modo, di, d.data)}
                                onChange={(e) => {
                                  const k2 = `${ln.id}|${modo}|${d.data}`;
                                  const original = ln[modo][di] != null ? String(ln[modo][di]) : '';
                                  const novo = { ...pend };
                                  if (e.target.value === original) delete novo[k2]; else novo[k2] = e.target.value;
                                  setPend(novo);
                                }}
                                title={dicaDia(ln, di)}
                                className={`h-8 w-[58px] rounded-[8px] border bg-m-surface-field px-1.5 text-right text-[13px] outline-none focus:border-m-accent disabled:border-transparent disabled:bg-transparent ${pend[`${ln.id}|${modo}|${d.data}`] !== undefined ? 'border-m-accent bg-m-accent-subtle' : modo === 'previsto' && ln.calc?.acima_capacidade[di] ? 'border-m-danger text-m-danger' : modo === 'realizado' ? 'border-m-info/40' : 'border-m-stroke'}`}
                              />
                              {modo === 'previsto' && ln.calc?.hh_previsto[di] ? <div className="mt-0.5 text-center text-[10px] text-m-text-muted"><Calculado rota={`/programacoes/${id}/linhas/${ln.id}/memoria`} chave={`hh_dia:${di}`}>{`${fmt(ln.calc.hh_previsto[di], 1)} HH`}</Calculado></div> : null}
                            </td>
                          ))}
                          <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-m-text-primary">
                            {fmt(modo === 'previsto' ? ln.total_previsto : ln.total_realizado)}
                            {ln.calc?.hh_un ? <div className="text-[11px] font-normal text-m-text-muted"><Calculado rota={`/programacoes/${id}/linhas/${ln.id}/memoria`} chave={modo === 'previsto' ? 'total_hh_previsto' : 'total_hh_realizado'}>{`${fmt(modo === 'previsto' ? ln.calc.total_hh_previsto : ln.calc.total_hh_realizado, 1)} HH`}</Calculado></div> : null}
                          </td>
                          <td className="whitespace-nowrap px-1 py-1.5">
                            {rascunho && pode('encarregado') && <>
                              <button type="button" aria-label="Editar linha" className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => abrirEdicao(ln)}><Pencil size={15} /></button>
                              <button type="button" aria-label="Excluir linha" className="p-1.5 text-m-text-muted hover:text-m-danger" onClick={async () => (await confirmar({ titulo: `Excluir a linha ${ln.codigo_simova} ${ln.descricao}?`, mensagem: 'Os valores previstos e realizados desta linha também saem da programação.' })) && excluir.mutate(ln.id)}><Trash2 size={15} /></button>
                            </>}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
            {v.linhas > 0 && (
              <tfoot>
                <tr className="text-xs font-semibold text-m-text-muted">
                  <td colSpan={6} className="px-2 pt-2 text-right uppercase">Soma do dia ({modo})</td>
                  {totalDia.map((t, i) => <td key={i} className="px-1 pt-2 text-right">{t ? fmt(t) : ''}</td>)}
                  <td colSpan={2} />
                </tr>
                {modo === 'previsto' && !!v.total_hh_previsto && (
                  <tr className="text-xs font-semibold text-m-text-muted">
                    <td colSpan={6} className="px-2 pt-1 text-right uppercase">HH previsto do dia (CPU)</td>
                    {(v.hh_previsto_dia ?? []).map((t, i) => <td key={i} className="px-1 pt-1 text-right">{t ? <Calculado rota={`/programacoes/${id}/memoria`} chave={`hh_dia:${i}`}>{fmt(t, 1)}</Calculado> : ''}</td>)}
                    <td className="px-2 pt-1 text-right text-m-text-primary"><Calculado rota={`/programacoes/${id}/memoria`} chave="total_hh_previsto">{fmt(v.total_hh_previsto, 1)}</Calculado></td>
                    <td />
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
        {nPend > 0 && (
          <div className="flex items-center justify-end gap-3 border-t border-m-stroke-subtle pt-3">
            <span className="text-[13px] text-m-text-secondary">{nPend} alteraç{nPend === 1 ? 'ão' : 'ões'} não salva{nPend === 1 ? '' : 's'}</span>
            <Botao variante="secundario" onClick={() => setPend({})}>Descartar</Botao>
            <Botao onClick={salvar} disabled={salvarTudo.isPending}><Save size={16} /> Salvar programação</Botao>
          </div>
        )}
        <Erro erro={salvarTudo.error ?? emitir.error ?? excluir.error} />
      </Painel>
    </>
  );
}

function dicaDia(ln: LinhaVisao, di: number): string | undefined {
  const c = ln.calc;
  if (!c || !ln.previsto[di]) return undefined;
  const partes = [c.hh_previsto[di] ? `${fmt(c.hh_previsto[di], 1)} HH` : null,
    c.oficiais[di] ? `${fmt(c.oficiais[di], 1)} ${c.recurso_governa ?? 'oficial'}(s)` : null,
    c.acima_capacidade[di] && c.capacidade_un_dia != null ? `acima da capacidade da equipe (${fmt(c.capacidade_un_dia)}/dia)` : null];
  return partes.filter(Boolean).join(' · ') || undefined;
}

/** Produção da linha pela CPU da obra: HH/un, quem governa, índice e capacidade da equipe (cada número abre a conta). */
function Calculo({ ln, pid }: { ln: LinhaVisao; pid: number }) {
  const c = ln.calc;
  if (!c) return null;
  const un = ln.unidade ?? 'un';
  const rota = `/programacoes/${pid}/linhas/${ln.id}/memoria`;
  return (
    <div className="mt-1 text-[11px] leading-snug text-m-text-secondary">
      {c.hh_un ? <>
        <Calculado rota={rota} chave="hh_un" titulo={`${c.descricao_composicao ?? ''} — ver de onde vem o HH`}>{c.composicao ?? ''}</Calculado>
        {' · '}<Calculado rota={rota} chave="hh_un">{`${fmt(c.hh_un, 3)} HH/${un}`}</Calculado>
        {c.recurso_governa && c.indice_un_dia ? <> · governa <Calculado rota={rota} chave="governa" className="font-semibold">{c.recurso_governa}</Calculado>{' '}
          (<Calculado rota={rota} chave="indice">{`${fmt(c.indice_un_dia)} ${un}/dia por pessoa`}</Calculado>)</> : null}
        {c.capacidade_un_dia != null && <> · equipe <Calculado rota={rota} chave="capacidade" className="font-semibold">{`${fmt(c.capacidade_un_dia)} ${un}/dia`}</Calculado>{c.gargalo ? ` (gargalo ${c.gargalo})` : ''}</>}
      </> : c.composicao ? <><Calculado rota={rota} chave="hh_un">{c.composicao}</Calculado> · sem mão de obra na CPU</> : null}
      {c.alertas.map((a) => <div key={a} className="text-m-warning">{a.includes('capacidade zero') ? <Calculado rota={rota} chave="capacidade">{a}</Calculado> : a}</div>)}
    </div>
  );
}
