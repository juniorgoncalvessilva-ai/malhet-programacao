'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, FileCheck2, Pencil, Plus, Printer, RotateCcw, Trash2, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Chip, Erro, Painel, Pilula, Selecao, dataBR, fmt } from '@/components/Obra/ui';
import { useEquipes } from '@/hooks/programacao/queries';
import { buscaAtividades, buscaPq, k, useAcao, useCatalogo, useFrentes2, useProgramacao } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import type { AtividadeBusca, ItemPqBusca, LinhaVisao } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

interface FormLinha {
  area_id: string; grupo_id: string; tipo_id: string; complemento: string; item_pq: string;
  equipe_id: string; id_crono: string; qtd_projeto: string; observacao: string;
}
const VAZIO: FormLinha = { area_id: '', grupo_id: '', tipo_id: '', complemento: '', item_pq: '', equipe_id: '', id_crono: '', qtd_projeto: '', observacao: '' };

export default function MontarPage() {
  const id = Number(useParams<{ id: string }>().id);
  const api = useApi();
  const { pode } = useObra();
  const prog = useProgramacao(id);
  const frentes = useFrentes2();
  const catalogo = useCatalogo();
  const equipes = useEquipes();
  const [modo, setModo] = useState<'previsto' | 'realizado'>('previsto');
  const [form, setForm] = useState<FormLinha>(VAZIO);
  const [editando, setEditando] = useState<number | null>(null);
  const [aberto, setAberto] = useState(false);
  const [qPq, setQPq] = useState('');
  const [qAt, setQAt] = useState('');

  const v = prog.data;
  const rascunho = v?.status === 'rascunho';
  const podeEditarValor = modo === 'realizado' ? pode('encarregado') : rascunho && pode('encarregado');
  const chave = [[...k.programacao(id)], [...k.programacoes], [...k.catalogo]];

  const salvarLinha = useAcao((a, d: FormLinha) => {
    const corpo = {
      area_id: Number(d.area_id), tipo_id: Number(d.tipo_id), complemento: d.complemento || null, item_pq: d.item_pq || null,
      equipe_id: d.equipe_id ? Number(d.equipe_id) : null, id_crono: d.id_crono || null,
      qtd_projeto: d.qtd_projeto ? Number(d.qtd_projeto) : null, observacao: d.observacao || null,
    };
    return editando
      ? a.put<{ aviso: string | null }>(`/programacoes/${id}/linhas/${editando}`, corpo)
      : a.post<{ aviso: string | null }>(`/programacoes/${id}/linhas`, corpo);
  }, chave);
  const excluir = useAcao((a, lid: number) => a.del(`/programacoes/${id}/linhas/${lid}`), chave);
  const emitir = useAcao((a) => a.post<{ revisao: number }>(`/programacoes/${id}/emitir`), chave);
  const reabrir = useAcao((a) => a.post(`/programacoes/${id}/reabrir`), chave);
  const valor = useAcao((a, d: { lid: number; data: string; valor: string }) =>
    a.put(`/programacoes/${id}/linhas/${d.lid}/valores`, { campo: modo, valores: [{ data: d.data, valor: d.valor === '' ? null : Number(d.valor) }] }),
  [[...k.programacao(id)]]);

  const grupo = catalogo.data?.find((g) => String(g.id) === form.grupo_id);
  const tipo = grupo?.tipos.find((t) => String(t.id) === form.tipo_id);
  const area = frentes.data?.flatMap((l) => l.areas).find((a) => String(a.id) === form.area_id);
  const pqBusca = useQuery({
    queryKey: ['pq-busca', qPq, area?.tag],
    queryFn: () => api.get<ItemPqBusca[]>(buscaPq(qPq, area?.tag)),
    enabled: aberto && (qPq.length >= 2 || !!tipo?.itens_pq.length),
  });
  const atBusca = useQuery({
    queryKey: ['at-busca', qAt, form.area_id],
    queryFn: () => api.get<AtividadeBusca[]>(buscaAtividades(qAt, form.area_id ? Number(form.area_id) : null)),
    enabled: aberto && !!form.area_id,
  });
  const opcoesPq = useMemo(() => {
    const permitidos = tipo?.itens_pq ?? [];
    const achados = pqBusca.data ?? [];
    return { permitidos, outros: achados.filter((x) => !permitidos.includes(x.item)) };
  }, [tipo, pqBusca.data]);

  useEffect(() => { if (tipo && tipo.itens_pq.length === 1 && !form.item_pq) setForm((f) => ({ ...f, item_pq: tipo.itens_pq[0] })); }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirNova = (areaId?: number) => { setEditando(null); setForm({ ...VAZIO, area_id: areaId ? String(areaId) : '' }); setAberto(true); };
  const abrirEdicao = (ln: LinhaVisao) => {
    const g = catalogo.data?.find((x) => x.tipos.some((t) => t.id === ln.tipo_id));
    setEditando(ln.id);
    setForm({ area_id: String(ln.area_id), grupo_id: g ? String(g.id) : '', tipo_id: String(ln.tipo_id), complemento: ln.complemento ?? '',
      item_pq: ln.item_pq ?? '', equipe_id: ln.equipe_id ? String(ln.equipe_id) : '', id_crono: ln.id_crono ?? '',
      qtd_projeto: ln.qtd_projeto != null && ln.qtd_projeto !== ln.qtd_takeoff ? String(ln.qtd_projeto) : '', observacao: ln.observacao ?? '' });
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
  const totalDia = v.dias.map((_, i) => v.locais.flatMap((l) => l.areas.flatMap((a) => a.linhas)).reduce((s, ln) => s + (Number(ln[modo][i]) || 0), 0));

  return (
    <>
      <Cabecalho
        eyebrow={`Programação ${v.tipo === 'SEMANAL' ? 'semanal' : 'mensal'} · montar`}
        titulo={`${v.titulo}: ${v.linhas} linha${v.linhas === 1 ? '' : 's'}`}
        descricao={<>Local → Área → atividade (grupo, tipo e texto complementar, que gera o ID do Simova) → item da PQ. {rascunho ? 'Previsto aberto para edição.' : 'Emitida: o previsto está travado; o realizado continua aberto.'}</>}
        acoes={<>
          <Pilula tom={rascunho ? 'neutro' : 'acento'}>{rascunho ? (v.revisao ? `Reaberta · rev. ${v.revisao}` : 'Rascunho') : `Emitida · rev. ${v.revisao - 1}`}</Pilula>
          <Link href={`/app/programacoes/${id}/imprimir`}><Botao variante="secundario"><Printer size={16} /> Imprimir</Botao></Link>
          {pode('admin') && <Botao variante="secundario" onClick={baixarFt}><Download size={16} /> FT Simova</Botao>}
          {pode('planejador') && (rascunho
            ? <Botao onClick={() => emitir.mutate(undefined, { onSuccess: (r) => toast.success(`Emitida · revisão ${r.revisao}`), onError: (e) => toast.error(e.message) })}><FileCheck2 size={16} /> Emitir</Botao>
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
            <Selecao rotulo="Atividade (tipo)" required value={form.tipo_id} onChange={(e) => setForm({ ...form, tipo_id: e.target.value, item_pq: '' })}>
              <option value="">{grupo ? 'Escolha…' : 'Escolha o grupo antes'}</option>
              {grupo?.tipos.filter((t) => t.ativo).map((t) => <option key={t.id} value={t.id}>{t.codigo} · {t.descricao}</option>)}
            </Selecao>
            <div>
              <Campo rotulo="Texto complementar (opcional)" list="complementos" placeholder="ex.: Fundo canaleta 2A" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
              <datalist id="complementos">{tipo?.itens.map((i) => <option key={i.id} value={i.complemento}>{i.codigo}</option>)}</datalist>
              {tipo && <p className="mt-1 text-xs text-m-text-muted">ID Simova: <b>{form.complemento.trim() ? (tipo.itens.find((i) => i.complemento.toLowerCase() === form.complemento.trim().replace(/^\(|\)$/g, '').toLowerCase())?.codigo ?? `${tipo.codigo}.novo`) : tipo.codigo}</b></p>}
            </div>
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
            <Selecao rotulo="Equipe / encarregado" value={form.equipe_id} onChange={(e) => setForm({ ...form, equipe_id: e.target.value })}>
              <option value="">—</option>
              {equipes.data?.map((e) => <option key={e.id} value={e.id}>{e.nome} · {e.encarregado_nome ?? 'sem encarregado'}{e.encarregado_cracha ? '' : ' (sem crachá)'}</option>)}
            </Selecao>
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
        subtitulo={`${dataBR(v.inicio)} a ${dataBR(v.fim)} · digite a quantidade de cada dia (sai do campo para salvar).`}
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
                {v.dias.map((d) => <th key={d.data} className={`px-1 pb-2 text-center ${['SÁB', 'DOM'].includes(d.dia) ? 'text-m-text-tertiary' : ''}`}>{d.dia}<div className="font-medium normal-case">{d.data.slice(8)}/{d.data.slice(5, 7)}</div></th>)}
                <th className="px-2 pb-2 text-right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!v.locais.length && <tr><td colSpan={v.dias.length + 7} className="py-10 text-center text-m-text-muted">Inclua a primeira linha: escolha a área, o grupo e o tipo.</td></tr>}
              {v.locais.map((l, li) => (
                <Fragment key={`l${l.id}`}>
                  <tr><td colSpan={v.dias.length + 7} className="bg-m-accent-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.4px] text-m-on-accent">{l.codigo} · {l.descricao}</td></tr>
                  {l.areas.map((a, ai) => (
                    <Fragment key={`a${a.id}`}>
                      <tr>
                        <td colSpan={v.dias.length + 7} className="border-b border-m-stroke-subtle bg-m-surface-active px-3 py-1.5 text-xs font-semibold text-m-accent">
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
                          </td>
                          <td className="px-2 py-2">{ln.item_pq ? <span title={ln.descricao_pq ?? ''}>{ln.item_pq}</span> : <span className="text-m-warning">sem PQ</span>}</td>
                          <td className="px-2 py-2">{ln.equipe ?? <span className="text-m-warning">sem equipe</span>}{ln.equipe && !ln.cracha && <div className="text-xs text-m-warning">sem crachá</div>}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">{ln.qtd_projeto != null ? `${fmt(ln.qtd_projeto)} ${ln.unidade ?? ''}` : '—'}</td>
                          {v.dias.map((d, di) => (
                            <td key={d.data} className="px-0.5 py-1.5">
                              <input
                                key={`${ln.id}-${d.data}-${modo}-${ln[modo][di] ?? ''}`}
                                aria-label={`${ln.codigo_simova} ${d.dia} ${d.data}`}
                                type="number" min="0" step="any" disabled={!podeEditarValor}
                                defaultValue={ln[modo][di] ?? ''}
                                onBlur={(e) => {
                                  const novo = e.target.value;
                                  if (novo === String(ln[modo][di] ?? '')) return;
                                  valor.mutate({ lid: ln.id, data: d.data, valor: novo }, { onError: (er) => toast.error(er.message) });
                                }}
                                className={`h-8 w-[58px] rounded-[8px] border bg-m-surface-field px-1.5 text-right text-[13px] outline-none focus:border-m-accent disabled:border-transparent disabled:bg-transparent ${modo === 'realizado' ? 'border-m-info/40' : 'border-m-stroke'}`}
                              />
                            </td>
                          ))}
                          <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-m-text-primary">{fmt(modo === 'previsto' ? ln.total_previsto : ln.total_realizado)}</td>
                          <td className="whitespace-nowrap px-1 py-1.5">
                            {rascunho && pode('encarregado') && <>
                              <button type="button" aria-label="Editar linha" className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => abrirEdicao(ln)}><Pencil size={15} /></button>
                              <button type="button" aria-label="Excluir linha" className="p-1.5 text-m-text-muted hover:text-m-danger" onClick={() => excluir.mutate(ln.id)}><Trash2 size={15} /></button>
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
                  <td colSpan={5} className="px-2 pt-2 text-right uppercase">Soma do dia ({modo})</td>
                  {totalDia.map((t, i) => <td key={i} className="px-1 pt-2 text-right">{t ? fmt(t) : ''}</td>)}
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <Erro erro={valor.error ?? emitir.error ?? excluir.error} />
      </Painel>
    </>
  );
}
