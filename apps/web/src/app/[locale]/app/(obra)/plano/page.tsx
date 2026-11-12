'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Diamond, ListTree, Plus, Send, ShieldAlert, Trash2, X } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Abas } from '@/components/Obra/Abas';
import { Calculado } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Botao, Cabecalho, Campo, Indicador, Painel, Pilula, Selecao, dataBR, fmt } from '@/components/Obra/ui';
import { useFrentes2, useProgramacoes, useWbs } from '@/hooks/programacao/planejamento';
import { useEquipes } from '@/hooks/programacao/queries';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';
import type { ItemPlano, NoWbs, PlanoResposta, PreviaMigracao, SituacaoPlano } from '@/lib/api/types';

type Aba = '90' | '6' | 'pull' | 'migrar';
const ROTULO: Record<SituacaoPlano, string> = { analisar: 'A analisar', restricao: 'Com restrição', liberado: 'Liberado', programado: 'Programado' };
const TOM: Record<SituacaoPlano, 'neutro' | 'perigo' | 'sucesso' | 'acento'> = { analisar: 'neutro', restricao: 'perigo', liberado: 'sucesso', programado: 'acento' };
const BARRA: Record<SituacaoPlano, string> = { analisar: 'bg-m-text-muted/40', restricao: 'bg-m-danger', liberado: 'bg-m-success', programado: 'bg-m-accent' };
const SEIS_M: Record<string, string> = { MDO: 'Mão de obra', MET: 'Método', MAT: 'Material', MAQ: 'Máquina', MAB: 'Meio ambiente', MED: 'Medida' };
const hoje = () => new Date().toISOString().slice(0, 10);
const somaDias = (iso: string, d: number) => { const x = new Date(`${iso}T12:00:00`); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function usePlano(semanas: number) {
  const api = useApi();
  return useQuery({ queryKey: ['plano', semanas], queryFn: () => api.get<PlanoResposta>(`/planos?semanas=${semanas}`) });
}

/** Plano de 90 dias (13 semanas), 6 semanas (make-ready) e pull planning, alimentando o 6WLA e as programações. */
export default function PlanoPage() {
  const [aba, setAba] = useState<Aba>('90');
  const plano = usePlano(aba === '6' ? 6 : 13);
  const { pode } = useObra();
  const [sel, setSel] = useState<number | null>(null);
  const [novo, setNovo] = useState(false);
  const [daWbs, setDaWbs] = useState(false);
  const itens = plano.data?.itens ?? [];
  const item = itens.find((i) => i.id === sel) ?? null;
  const r = plano.data?.resumo;
  return (
    <>
      <Cabecalho eyebrow="Programar · plano de 90 dias" titulo="Plano de 90 dias"
        acoes={pode('planejador') && <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => { setDaWbs(true); setNovo(false); }}><ListTree size={16} /> Puxar da WBS</Botao>
          <Botao onClick={() => { setNovo(true); setDaWbs(false); }}><Plus size={16} /> Atividade ou marco</Botao>
        </div>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(Object.keys(ROTULO) as SituacaoPlano[]).map((k) => <Indicador key={k} rotulo={ROTULO[k]} valor={r?.[k] ?? '—'} tom={k === 'restricao' && r?.[k] ? 'perigo' : k === 'liberado' ? 'sucesso' : undefined} />)}
      </div>
      {novo && <FormItem onFechar={() => setNovo(false)} marcos={itens.filter((i) => i.marco)} />}
      {daWbs && <FormDaWbs onFechar={() => setDaWbs(false)} marcos={itens.filter((i) => i.marco)} />}
      <Abas rotulo="Horizonte" ativa={aba} onTrocar={(a) => { setAba(a); setSel(null); }} abas={[
        { chave: '90', titulo: '90 dias' }, { chave: '6', titulo: '6 semanas' }, { chave: 'pull', titulo: 'Pull planning' }, { chave: 'migrar', titulo: 'Levar à programação' },
      ]} />
      {plano.isLoading && <p className="text-sm text-m-text-muted">Carregando…</p>}
      {(aba === '90' || aba === '6') && plano.data && <Grade dados={plano.data} seis={aba === '6'} sel={sel} onSel={setSel} />}
      {aba === 'pull' && plano.data && <Pull itens={itens} onSel={setSel} />}
      {aba === 'migrar' && <Migrar />}
      {item && aba !== 'migrar' && <Detalhe item={item} marcos={itens.filter((i) => i.marco && i.id !== item.id)} onFechar={() => setSel(null)} />}
    </>
  );
}

function Grade({ dados, seis, sel, onSel }: { dados: PlanoResposta; seis: boolean; sel: number | null; onSel: (id: number) => void }) {
  const { semanas } = dados;
  const grupos = useMemo(() => {
    const m = new Map<string, ItemPlano[]>();
    for (const i of dados.itens) {
      if (i.fim < semanas[0].inicio || i.inicio > semanas[semanas.length - 1].fim) continue; // puxado fora do horizonte
      const k = i.marco ? '◆ Marcos' : (i.area ?? 'Sem área');
      m.set(k, [...(m.get(k) ?? []), i]);
    }
    return [...m.entries()].sort(([a], [b]) => (a.startsWith('◆') ? -1 : b.startsWith('◆') ? 1 : a.localeCompare(b, 'pt-BR', { numeric: true })));
  }, [dados, semanas]);
  const h = hoje();
  if (!grupos.length) return <p className="rounded-m-lg border border-dashed border-m-stroke p-8 text-center text-sm text-m-text-secondary">Nada pensado para este horizonte ainda. Puxe da WBS ou crie a atividade.</p>;
  return (
    <div className="overflow-x-auto rounded-m-lg border border-m-stroke-subtle bg-m-surface-raised">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.3px] text-m-text-muted">
            <th className="sticky left-0 z-10 min-w-[320px] bg-m-surface-raised px-3 py-2">Atividade</th>
            <th className="px-2 py-2">Situação</th>
            {seis && <th className="px-2 py-2">Restrições</th>}
            {semanas.map((s) => (
              <th key={s.inicio} className={`min-w-[52px] px-1 py-2 text-center ${s.inicio <= h && h <= s.fim ? 'text-m-accent' : ''}`}>{dm(s.inicio)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map(([g, lista]) => (
            <Fragment key={g}>
              <tr><td colSpan={semanas.length + (seis ? 3 : 2)} className="bg-m-surface-hover px-3 py-1.5 text-[12px] font-semibold text-m-text-primary">{g}</td></tr>
              {lista.map((i) => (
                <tr key={i.id} onClick={() => onSel(i.id)} className={`cursor-pointer border-b border-m-row hover:bg-m-surface-hover ${sel === i.id ? 'bg-m-accent-subtle' : ''}`}>
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                    <div className="font-medium text-m-text-primary">{i.marco && <Diamond size={12} className="mr-1 inline text-m-warning" />}{i.descricao}</div>
                    <div className="text-[11px] text-m-text-muted">{i.codigo} · {dataBR(i.inicio)}{i.fim !== i.inicio ? ` a ${dataBR(i.fim)}` : ''}{i.equipe ? ` · ${i.equipe}` : ''}{i.quantidade != null ? ` · ${fmt(i.quantidade)}` : ''}</div>
                  </td>
                  <td className="px-2 py-2">{!i.marco && <Pilula tom={TOM[i.situacao]}>{ROTULO[i.situacao]}</Pilula>}</td>
                  {seis && <td className="whitespace-nowrap px-2 py-2 text-[12px]">{i.marco ? '' : i.pendentes ? <span className="text-m-danger">{i.pendentes} pendente(s){i.restricoes.filter((x) => x.status1 === 'Pendente').map((x) => x.prazo).filter(Boolean).sort()[0] ? ` · até ${dm(i.restricoes.filter((x) => x.status1 === 'Pendente').map((x) => x.prazo!).filter(Boolean).sort()[0])}` : ''}</span> : i.analisado ? 'nenhuma' : <span className="text-m-text-muted">não analisado</span>}</td>}
                  {semanas.map((s) => {
                    const dentro = i.inicio <= s.fim && i.fim >= s.inicio;
                    return <td key={s.inicio} className="px-0.5 py-2">{dentro && (i.marco
                      ? <div className="mx-auto h-3 w-3 rotate-45 bg-m-warning" title={`Marco ${dataBR(i.fim)}`} />
                      : <div className={`h-3 ${BARRA[i.situacao]} ${i.inicio >= s.inicio ? 'rounded-l-full' : ''} ${i.fim <= s.fim ? 'rounded-r-full' : ''}`} />)}</td>;
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pull({ itens, onSel }: { itens: ItemPlano[]; onSel: (id: number) => void }) {
  const marcos = itens.filter((i) => i.marco).sort((a, b) => a.fim.localeCompare(b.fim));
  if (!marcos.length) return <p className="rounded-m-lg border border-dashed border-m-stroke p-8 text-center text-sm text-m-text-secondary">Crie um marco (“Atividade ou marco” → marcar como marco) e puxe para ele as atividades que precisam terminar antes.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {marcos.map((m) => {
        const puxadas = itens.filter((i) => i.marco_id === m.id).sort((a, b) => b.fim.localeCompare(a.fim));
        const prontas = puxadas.filter((i) => i.situacao === 'liberado' || i.situacao === 'programado').length;
        return (
          <Painel key={m.id} titulo={<span className="inline-flex items-center gap-2"><Diamond size={15} className="text-m-warning" />{m.descricao}</span>}
            subtitulo={`${m.codigo} · marco em ${dataBR(m.fim)} · ${prontas} de ${puxadas.length} atividade(s) liberada(s)`}>
            <ol className="flex flex-col gap-2">
              {puxadas.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => onSel(i.id)} className={`flex w-full items-center justify-between gap-3 rounded-m-md border px-3 py-2 text-left hover:bg-m-surface-hover ${i.fim > m.fim ? 'border-m-danger' : 'border-m-stroke-subtle'}`}>
                    <span className="min-w-0"><span className="block truncate text-[13px] font-medium text-m-text-primary">{i.descricao}</span>
                      <span className="text-[11.5px] text-m-text-muted">{i.codigo} · termina {dataBR(i.fim)}{i.fim > m.fim ? ' · depois do marco' : ''}{i.area ? ` · ${i.area}` : ''}</span></span>
                    <Pilula tom={TOM[i.situacao]}>{ROTULO[i.situacao]}</Pilula>
                  </button>
                </li>
              ))}
              {!puxadas.length && <li className="text-[13px] text-m-text-muted">Nada puxado ainda: abra uma atividade e escolha este marco.</li>}
            </ol>
          </Painel>
        );
      })}
    </div>
  );
}

function useAtualizar() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ['plano'] }); qc.invalidateQueries({ queryKey: ['restricoes'] }); qc.invalidateQueries({ queryKey: ['plano-migrar'] }); };
}

function Detalhe({ item, marcos, onFechar }: { item: ItemPlano; marcos: ItemPlano[]; onFechar: () => void }) {
  const api = useApi();
  const atualizar = useAtualizar();
  const confirmar = useConfirmar();
  const { pode } = useObra();
  const [editar, setEditar] = useState(false);
  const [r, setR] = useState({ acao: '', responsavel: '', prazo_termino: '', seis_m: '', impeditivo: true });
  const pedir = (p: Promise<unknown>, ok: string) => p.then(() => { toast.success(ok); atualizar(); }).catch((e) => toast.error(e.message));
  if (editar) return <FormItem item={item} marcos={marcos} onFechar={() => setEditar(false)} />;
  return (
    <Painel titulo={`${item.codigo} · ${item.descricao}`}
      subtitulo={`${item.marco ? 'Marco' : ROTULO[item.situacao]} · ${dataBR(item.inicio)} a ${dataBR(item.fim)}${item.area ? ` · ${item.area}` : ''}${item.equipe ? ` · ${item.equipe}` : ''}`}
      acoes={<div className="flex gap-2">
        {pode('planejador') && <Botao variante="secundario" onClick={() => setEditar(true)}>Editar</Botao>}
        {pode('planejador') && <Botao variante="excluir" aria-label="Excluir item" onClick={async () => (await confirmar({ titulo: `Excluir ${item.codigo}?`, mensagem: item.descricao }))
          && api.del(`/planos/itens/${item.id}`).then(() => { toast.success('Item excluído'); atualizar(); onFechar(); }).catch((e) => toast.error(e.message))}><Trash2 size={15} /></Botao>}
        <Botao variante="fantasma" aria-label="Fechar" onClick={onFechar}><X size={16} /></Botao>
      </div>}>
      {item.programacoes.length > 0 && <p className="text-[13px] text-m-text-secondary">Na programação: {item.programacoes.map((p, k) => <Fragment key={p.id}>{k ? ', ' : ''}<Link href={`/app/programacoes/${p.id}`} className="font-semibold text-m-accent underline">{p.titulo}</Link></Fragment>)}</p>}
      {!item.marco && <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-m-text-primary">Restrições (alimentam o <Link href="/app/restricoes" className="text-m-accent underline">Restrições 6WLA</Link>)</h3>
          {pode('encarregado') && !item.pendentes && (item.analisado
            ? <Botao variante="secundario" onClick={() => pedir(api.put(`/planos/itens/${item.id}/analise`, { analisado: false }), 'Análise desfeita')}>Refazer análise</Botao>
            : <Botao onClick={() => pedir(api.put(`/planos/itens/${item.id}/analise`, { analisado: true }), 'Sem restrições: atividade liberada')}><CheckCircle2 size={16} /> Analisado, sem restrições</Botao>)}
        </div>
        <ul className="flex flex-col gap-1.5">
          {item.restricoes.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-m-md border border-m-stroke-subtle px-3 py-2 text-[13px]">
              <span className="min-w-0"><b className="text-m-text-primary">Nº {x.numero}</b> · {x.acao}<span className="block text-[11.5px] text-m-text-muted">{[x.responsavel, x.prazo && `prazo ${dataBR(x.prazo)}`, x.seis_m && SEIS_M[x.seis_m], x.impeditivo === false ? 'não impeditiva' : 'impeditiva'].filter(Boolean).join(' · ')}</span></span>
              <span className="flex items-center gap-2">
                <Pilula tom={x.status1 === 'Concluído' ? 'sucesso' : x.status1 === 'Cancelado' ? 'neutro' : x.farol === 'Atrasado' ? 'perigo' : 'atencao'}>{x.status1 === 'Pendente' ? x.farol : x.status1}</Pilula>
                {x.status1 === 'Pendente' && pode('encarregado') && <>
                  <Botao variante="secundario" onClick={() => pedir(api.post(`/planos/restricoes/${x.id}/limpar`, { status1: 'Concluído' }), `Restrição ${x.numero} limpa`)}>Limpar</Botao>
                  <Botao variante="fantasma" onClick={async () => (await confirmar({ titulo: `Cancelar a restrição ${x.numero}?`, mensagem: x.acao }))
                    && pedir(api.post(`/planos/restricoes/${x.id}/limpar`, { status1: 'Cancelado' }), 'Restrição cancelada')}>Cancelar</Botao>
                </>}
              </span>
            </li>
          ))}
          {!item.restricoes.length && <li className="text-[13px] text-m-text-muted">{item.analisado ? 'Analisado: nenhuma restrição.' : 'Ainda não analisado: levante as restrições ou marque "sem restrições".'}</li>}
        </ul>
        {pode('encarregado') && (
          <form className="grid gap-2 md:grid-cols-[1fr_180px_150px_120px_auto_auto] md:items-end" onSubmit={(e) => {
            e.preventDefault();
            pedir(api.post(`/planos/itens/${item.id}/restricoes`, { ...r, prazo_termino: r.prazo_termino || null, seis_m: r.seis_m || null, responsavel: r.responsavel || null })
              .then(() => setR({ acao: '', responsavel: '', prazo_termino: '', seis_m: '', impeditivo: true })), 'Restrição enviada ao 6WLA');
          }}>
            <Campo rotulo="Nova restrição (ação para remover)" value={r.acao} onChange={(e) => setR({ ...r, acao: e.target.value })} required minLength={3} />
            <Campo rotulo="Responsável" value={r.responsavel} onChange={(e) => setR({ ...r, responsavel: e.target.value })} />
            <Campo rotulo="Prazo" type="date" value={r.prazo_termino} onChange={(e) => setR({ ...r, prazo_termino: e.target.value })} />
            <Selecao rotulo="6M" value={r.seis_m} onChange={(e) => setR({ ...r, seis_m: e.target.value })}><option value="">—</option>{Object.entries(SEIS_M).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Selecao>
            <label className="flex items-center gap-1.5 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={r.impeditivo} onChange={(e) => setR({ ...r, impeditivo: e.target.checked })} /> Impeditiva</label>
            <Botao type="submit"><ShieldAlert size={16} /> Levantar</Botao>
          </form>
        )}
      </>}
    </Painel>
  );
}

function FormItem({ item, marcos, onFechar }: { item?: ItemPlano; marcos: ItemPlano[]; onFechar: () => void }) {
  const api = useApi();
  const atualizar = useAtualizar();
  const frentes = useFrentes2();
  const equipes = useEquipes();
  const [f, setF] = useState({
    descricao: item?.descricao ?? '', area_id: item?.area_id ? String(item.area_id) : '', equipe_id: item?.equipe_id ? String(item.equipe_id) : '',
    inicio: item?.inicio ?? hoje(), fim: item?.fim ?? somaDias(hoje(), 6), quantidade: item?.quantidade != null ? String(item.quantidade) : '',
    responsavel: item?.responsavel ?? '', marco: item?.marco ?? false, marco_id: item?.marco_id ? String(item.marco_id) : '', observacao: item?.observacao ?? '',
  });
  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    const corpo = { ...f, area_id: f.area_id ? Number(f.area_id) : null, equipe_id: f.equipe_id ? Number(f.equipe_id) : null,
      quantidade: f.quantidade.trim() ? Number(f.quantidade.replace(',', '.')) : null, marco_id: f.marco_id ? Number(f.marco_id) : null,
      fim: f.marco ? f.inicio : f.fim, wbs_no_id: item?.wbs_no_id ?? null, tipo_id: item?.tipo_id ?? null };
    (item ? api.put(`/planos/itens/${item.id}`, corpo) : api.post('/planos/itens', corpo))
      .then(() => { toast.success(item ? 'Item salvo' : 'Item no plano'); atualizar(); onFechar(); }).catch((er) => toast.error(er.message));
  };
  return (
    <Painel titulo={item ? `Editar ${item.codigo}` : 'Nova atividade ou marco no plano'}>
      <form onSubmit={salvar} className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2"><Campo rotulo={f.marco ? 'Marco (o que precisa estar pronto)' : 'Atividade'} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} required={!item?.wbs_no_id} /></div>
        <label className="flex items-end gap-2 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={f.marco} onChange={(e) => setF({ ...f, marco: e.target.checked })} /> É um marco (pull planning)</label>
        {!f.marco && <Selecao rotulo="Puxada pelo marco" value={f.marco_id} onChange={(e) => setF({ ...f, marco_id: e.target.value })}>
          <option value="">—</option>{marcos.filter((m) => m.id !== item?.id).map((m) => <option key={m.id} value={m.id}>{m.codigo} · {m.descricao} ({dataBR(m.fim)})</option>)}
        </Selecao>}
        <Campo rotulo={f.marco ? 'Data do marco' : 'Início'} type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} required />
        {!f.marco && <Campo rotulo="Fim" type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} required />}
        {!item?.wbs_no_id && <Selecao rotulo="Área" value={f.area_id} onChange={(e) => setF({ ...f, area_id: e.target.value })}>
          <option value="">—</option>
          {frentes.data?.map((l) => <optgroup key={l.id} label={`${l.codigo} · ${l.descricao}`}>{l.areas.filter((a) => a.ativo).map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.descricao}</option>)}</optgroup>)}
        </Selecao>}
        {!f.marco && <Selecao rotulo="Equipe" value={f.equipe_id} onChange={(e) => setF({ ...f, equipe_id: e.target.value })}>
          <option value="">—</option>{equipes.data?.filter((e) => e.ativo).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </Selecao>}
        {!f.marco && <Campo rotulo="Quantidade" inputMode="decimal" value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: e.target.value })} />}
        <Campo rotulo="Responsável" value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} />
        <div className="md:col-span-2"><Campo rotulo="Observação" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></div>
        <div className="flex items-end gap-2 md:col-span-4">
          <Botao type="submit">Salvar</Botao><Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
          {!item?.wbs_no_id && !f.marco && <span className="text-[12px] text-m-text-muted">Para virar linha da programação, puxe pela WBS (IWP) — atividade livre fica no plano e no 6WLA.</span>}
        </div>
      </form>
    </Painel>
  );
}

function achatar(nos: NoWbs[], prof = 0, out: { id: number; rotulo: string }[] = []) {
  for (const n of nos) {
    out.push({ id: n.id, rotulo: `${'  '.repeat(prof)}${n.codigo} · ${n.titulo}` });
    if (n.tipo !== 'iwp') achatar(n.filhos, prof + 1, out);
  }
  return out;
}

function FormDaWbs({ marcos, onFechar }: { marcos: ItemPlano[]; onFechar: () => void }) {
  const api = useApi();
  const atualizar = useAtualizar();
  const wbs = useWbs();
  const equipes = useEquipes();
  const opcoes = useMemo(() => achatar(wbs.data?.arvore ?? []), [wbs.data]);
  const [f, setF] = useState({ no: '', inicio: '', fim: '', equipe_id: '', marco_id: '' });
  return (
    <Painel titulo="Puxar atividades da WBS de execução">
      <form className="grid gap-3 md:grid-cols-6 md:items-end" onSubmit={(e) => {
        e.preventDefault();
        api.post<{ criados: number; ja_estavam: number; sem_data: number }>('/planos/itens/da-wbs', { nos: [Number(f.no)], inicio: f.inicio || null, fim: f.fim || null,
          equipe_id: f.equipe_id ? Number(f.equipe_id) : null, marco_id: f.marco_id ? Number(f.marco_id) : null })
          .then((r) => { toast.success(`${r.criados} atividade(s) no plano${r.ja_estavam ? ` · ${r.ja_estavam} já estavam` : ''}`); if (r.sem_data) toast.warning(`${r.sem_data} IWP(s) sem datas: informe início e fim`); atualizar(); onFechar(); })
          .catch((er) => toast.error(er.message));
      }}>
        <div className="md:col-span-2"><Selecao rotulo="Nó da WBS (todos os IWPs abaixo)" value={f.no} onChange={(e) => setF({ ...f, no: e.target.value })} required>
          <option value="">— escolher —</option>{opcoes.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
        </Selecao></div>
        <Campo rotulo="Início (vazio = do cronograma)" type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />
        <Campo rotulo="Fim (vazio = do cronograma)" type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} />
        <Selecao rotulo="Equipe" value={f.equipe_id} onChange={(e) => setF({ ...f, equipe_id: e.target.value })}><option value="">—</option>{equipes.data?.filter((e) => e.ativo).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</Selecao>
        <Selecao rotulo="Puxada pelo marco" value={f.marco_id} onChange={(e) => setF({ ...f, marco_id: e.target.value })}><option value="">—</option>{marcos.map((m) => <option key={m.id} value={m.id}>{m.codigo} · {m.descricao}</option>)}</Selecao>
        <div className="flex gap-2 md:col-span-6"><Botao type="submit">Puxar</Botao><Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao></div>
      </form>
    </Painel>
  );
}

function Migrar() {
  const api = useApi();
  const atualizar = useAtualizar();
  const { pode } = useObra();
  const progs = useProgramacoes();
  const abertas = (progs.data ?? []).filter((p) => p.status === 'rascunho');
  const [pid, setPid] = useState<number | null>(null);
  const previa = useQuery({ queryKey: ['plano-migrar', pid], enabled: !!pid, queryFn: () => api.get<PreviaMigracao>(`/planos/migrar/${pid}`) });
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [qtd, setQtd] = useState<Record<number, string>>({});
  const [res, setRes] = useState<{ criadas: number; bloqueados: string[]; avisos: string[] } | null>(null);
  const lista = previa.data?.itens ?? [];
  const semanal = previa.data?.programacao.tipo === 'SEMANAL';
  const migrar = () => {
    const q: Record<number, number | null> = {};
    for (const id of marcados) if (qtd[id] !== undefined) q[id] = qtd[id].trim() ? Number(qtd[id].replace(',', '.')) : null;
    api.post<{ criadas: number; bloqueados: string[]; avisos: string[] }>('/planos/migrar', { programacao_id: pid, itens: [...marcados], qtd: q })
      .then((r) => { setRes(r); setMarcados(new Set()); toast.success(`${r.criadas} linha(s) na programação`); atualizar(); }).catch((e) => toast.error(e.message));
  };
  return (
    <Painel titulo="Levar atividades do plano para a programação mensal ou semanal">
      <div className="flex flex-wrap items-end gap-3">
        <Selecao rotulo="Programação (em rascunho)" value={pid ?? ''} onChange={(e) => { setPid(e.target.value ? Number(e.target.value) : null); setMarcados(new Set()); setRes(null); }} className="min-w-[320px]">
          <option value="">— escolher —</option>{abertas.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
        </Selecao>
        {pid && pode('encarregado') && <Botao disabled={!marcados.size} onClick={migrar}><Send size={16} /> Levar {marcados.size || ''} item(ns)</Botao>}
        {pid && <Link href={`/app/programacoes/${pid}`} className="pb-2.5 text-[13px] font-semibold text-m-accent underline">abrir a programação</Link>}
      </div>
      {semanal && <p className="text-[12.5px] text-m-text-muted">Na semanal só entra atividade sem restrição pendente (limpe no 6WLA ou no detalhe do item). Na mensal entra com aviso.</p>}
      {res && (res.bloqueados.length > 0 || res.avisos.length > 0) && <div className="rounded-m-md border border-m-stroke-subtle p-3 text-[12.5px]">
        {res.bloqueados.map((b) => <p key={b} className="text-m-danger">{b}</p>)}{res.avisos.map((a) => <p key={a} className="text-m-warning">{a}</p>)}
      </div>}
      {pid && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead><tr className="text-left text-[11px] uppercase tracking-[0.3px] text-m-text-muted">
              <th className="px-2 py-2" /><th className="px-2 py-2">Atividade</th><th className="px-2 py-2">Janela</th><th className="px-2 py-2">Situação</th>
              <th className="px-2 py-2 text-right">Sugerida no período</th><th className="px-2 py-2 text-right">Levar</th>
            </tr></thead>
            <tbody>
              {lista.map((i) => {
                const pode_ = !i.ja_na_programacao && i.migravel && !(semanal && i.pendentes);
                return (
                  <tr key={i.id} className="border-b border-m-row">
                    <td className="px-2 py-2"><input type="checkbox" aria-label={`Levar ${i.codigo}`} disabled={!pode_} checked={marcados.has(i.id)}
                      onChange={() => setMarcados((m) => { const n = new Set(m); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; })} /></td>
                    <td className="px-2 py-2"><div className="font-medium text-m-text-primary">{i.descricao}</div><div className="text-[11.5px] text-m-text-muted">{i.codigo}{i.area ? ` · ${i.area}` : ''}{i.equipe ? ` · ${i.equipe}` : ''}</div></td>
                    <td className="whitespace-nowrap px-2 py-2">{dm(i.inicio)} a {dm(i.fim)}</td>
                    <td className="px-2 py-2">{i.ja_na_programacao ? <Pilula tom="acento">já está nela</Pilula> : !i.migravel ? <Pilula tom="neutro">sem IWP</Pilula> : <Pilula tom={TOM[i.situacao]}>{ROTULO[i.situacao]}{i.pendentes ? ` (${i.pendentes})` : ''}</Pilula>}</td>
                    <td className="px-2 py-2 text-right">{i.qtd_sugerida != null && previa.data?.memorias[`qtd-${i.codigo}`]
                      ? <Calculado chave={`qtd-${i.codigo}`} memoria={() => previa.data!.memorias[`qtd-${i.codigo}`]}>{fmt(i.qtd_sugerida)}</Calculado> : '—'}{i.unid ? ` ${i.unid}` : ''}</td>
                    <td className="px-2 py-2 text-right"><input aria-label={`Quantidade de ${i.codigo}`} disabled={!pode_} inputMode="decimal" placeholder={i.qtd_sugerida != null ? fmt(i.qtd_sugerida) : ''}
                      value={qtd[i.id] ?? ''} onChange={(e) => setQtd({ ...qtd, [i.id]: e.target.value })} className="h-8 w-24 rounded-m-sm border border-m-stroke bg-m-surface-field px-2 text-right" /></td>
                  </tr>
                );
              })}
              {!lista.length && !previa.isLoading && <tr><td colSpan={6} className="px-2 py-6 text-center text-m-text-muted">Nenhuma atividade do plano cai no período desta programação.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Painel>
  );
}
