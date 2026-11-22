'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CalendarSearch, CheckCircle2, Diamond, Eraser, GanttChart, ListTree, Plus, Send, ShieldAlert, Trash2, X } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Abas } from '@/components/Obra/Abas';
import { Calculado } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { PilulaProjetos } from '@/components/Documentos/PilulaProjetos';
import { Botao, Cabecalho, Campo, Indicador, Painel, Pilula, Selecao, dataBR, fmt } from '@/components/Obra/ui';
import { useSituacaoProjetos } from '@/lib/documentos/ativos';
import { useFrentes2, useProgramacoes, useWbs } from '@/hooks/programacao/planejamento';
import { useEquipes } from '@/hooks/programacao/queries';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';
import type { AtividadePeriodo, ItemPlano, NoWbs, PlanoResposta, PreviaMigracao, RecursoP6, SituacaoPlano } from '@/lib/api/types';
import { Carregando } from '@/components/Obra/Esqueleto';
import { Exportar6wla } from '@/components/Plano/Exportar6wla';

type Aba = '90' | '6' | 'pull' | 'migrar';
const ROTULO: Record<SituacaoPlano, string> = { analisar: 'A analisar', restricao: 'Com restrição', liberado: 'Liberado', programado: 'Programado' };
const TOM: Record<SituacaoPlano, 'neutro' | 'perigo' | 'sucesso' | 'acento'> = { analisar: 'neutro', restricao: 'perigo', liberado: 'sucesso', programado: 'acento' };
const BARRA: Record<SituacaoPlano, string> = { analisar: 'bg-m-text-muted opacity-50', restricao: 'bg-m-danger', liberado: 'bg-m-success', programado: 'bg-m-accent' };
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
  const [doCrono, setDoCrono] = useState(false);
  const [daProg, setDaProg] = useState(false);
  const api = useApi();
  const atualizar = useAtualizar();
  const confirmar = useConfirmar();
  const tirarConcluidas = async () => {
    if (!(await confirmar({ titulo: 'Excluir do plano as atividades concluídas?', mensagem: 'Saem as que estão concluídas no cronograma vigente. Ficam as que já foram para a programação ou têm restrição pendente no 6WLA.' }))) return;
    api.post<{ removidos: number; mantidos: string[] }>('/planos/tirar-concluidas')
      .then((r) => { toast.success(`${r.removidos} atividade(s) concluída(s) excluída(s) do plano`); r.mantidos.slice(0, 4).forEach((m) => toast.warning(m)); atualizar(); })
      .catch((e) => toast.error(e.message));
  };
  const itens = plano.data?.itens ?? [];
  const item = itens.find((i) => i.id === sel) ?? null;
  const r = plano.data?.resumo;
  return (
    <>
      <Cabecalho eyebrow="Programar · plano de 90 dias" titulo="Plano de 90 dias"
        acoes={pode('planejador') && <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => { setDaProg(true); setDoCrono(false); setDaWbs(false); setNovo(false); }} title="As linhas da programação corrente viram atividades do plano (e ficam ligadas a elas)"><CalendarDays size={16} /> Puxar da programação</Botao>
          <Botao variante="secundario" onClick={() => { setDoCrono(true); setDaProg(false); setDaWbs(false); setNovo(false); }} title="Melhor quando o cronograma muda pouco"><GanttChart size={16} /> Puxar do cronograma</Botao>
          <Botao variante="secundario" onClick={() => { setDaWbs(true); setNovo(false); setDoCrono(false); }}><ListTree size={16} /> Inserir pela WBS</Botao>
          <Botao variante="secundario" onClick={tirarConcluidas}><Eraser size={16} /> Excluir concluídas</Botao>
          <Botao onClick={() => { setNovo(true); setDaWbs(false); }}><Plus size={16} /> Atividade ou marco</Botao>
        </div>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(Object.keys(ROTULO) as SituacaoPlano[]).map((k) => <Indicador key={k} rotulo={ROTULO[k]} valor={r?.[k] ?? '—'} tom={k === 'restricao' && r?.[k] ? 'perigo' : k === 'liberado' ? 'sucesso' : undefined} />)}
      </div>
      {novo && <FormItem onFechar={() => setNovo(false)} marcos={itens.filter((i) => i.marco)} />}
      {daProg && <FormDaProgramacao onFechar={() => setDaProg(false)} />}
      {doCrono && <FormDoCronograma onFechar={() => setDoCrono(false)} marcos={itens.filter((i) => i.marco)} />}
      {daWbs && <FormDaWbs onFechar={() => setDaWbs(false)} marcos={itens.filter((i) => i.marco)} />}
      <Abas rotulo="Horizonte" ativa={aba} onTrocar={(a) => { setAba(a); setSel(null); }} abas={[
        { chave: '90', titulo: '90 dias' }, { chave: '6', titulo: '6 semanas' }, { chave: 'pull', titulo: 'Pull planning' }, { chave: 'migrar', titulo: 'Levar à programação' },
      ]} />
      {aba === '6' && <Exportar6wla />}
      {plano.isLoading && <Carregando />}
      {(aba === '90' || aba === '6') && plano.data && <Grade dados={plano.data} seis={aba === '6'} sel={sel} onSel={(id) => setSel(sel === id ? null : id)}
        detalhe={item && <Detalhe item={item} marcos={itens.filter((i) => i.marco && i.id !== item.id)} onFechar={() => setSel(null)} />} />}
      {aba === 'pull' && plano.data && <Pull itens={itens} onSel={setSel} />}
      {aba === 'migrar' && <Migrar />}
      {item && aba === 'pull' && <Detalhe item={item} marcos={itens.filter((i) => i.marco && i.id !== item.id)} onFechar={() => setSel(null)} />}
    </>
  );
}

/**
 * 90 dias / 6 semanas no padrão da programação mensal (spec 081): Local (faixa vermelha) → Área (azul) → CWP → atividades
 * em linhas alternadas, com WBS, etapa, item da PQ, equipe e quantidade, e as semanas do horizonte à direita.
 */
function Grade({ dados, seis, sel, onSel, detalhe }: { dados: PlanoResposta; seis: boolean; sel: number | null; onSel: (id: number) => void; detalhe?: React.ReactNode }) {
  const { semanas } = dados;
  const h = hoje();
  const projetosDa = useSituacaoProjetos();
  // spec 085: recolher pela estrutura (Local → Área → CWP), como na WBS
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const alternar = (k: string) => setFechados((f) => { const n = new Set(f); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const estrutura = useMemo(() => {
    const visiveis = dados.itens.filter((i) => !(i.fim < semanas[0].inicio || i.inicio > semanas[semanas.length - 1].fim));
    const marcos = visiveis.filter((i) => i.marco).sort((a, b) => a.fim.localeCompare(b.fim));
    const locais = new Map<string, Map<string, Map<string, ItemPlano[]>>>();
    for (const i of visiveis.filter((x) => !x.marco)) {
      const l = i.local ?? 'Sem local'; const a = i.area ?? 'Sem área'; const c = i.cwp?.texto ?? '';
      if (!locais.has(l)) locais.set(l, new Map());
      const ma = locais.get(l)!; if (!ma.has(a)) ma.set(a, new Map());
      const mc = ma.get(a)!; mc.set(c, [...(mc.get(c) ?? []), i]);
    }
    const ord = (x: string, y: string) => x.localeCompare(y, 'pt-BR', { numeric: true });
    return {
      marcos,
      locais: [...locais.entries()].sort(([x], [y]) => ord(x, y)).map(([l, ma]) => ({ l, areas: [...ma.entries()].sort(([x], [y]) => ord(x, y))
        .map(([a, mc]) => ({ a, cwps: [...mc.entries()].sort(([x], [y]) => ord(x, y)).map(([c, its]) => ({ c, itens: its.sort((x, y) => (x.wbs_codigo ?? x.codigo).localeCompare(y.wbs_codigo ?? y.codigo, 'pt-BR', { numeric: true })) })) })) })),
    };
  }, [dados, semanas]);
  if (!estrutura.locais.length && !estrutura.marcos.length) return <p className="rounded-m-lg border border-dashed border-m-stroke p-8 text-center text-sm text-m-text-secondary">Nada pensado para este horizonte ainda. Insira pela WBS (inclusive o que não está no cronograma) ou crie a atividade.</p>;
  const colunas = semanas.length + (seis ? 7 : 6);
  let n = 0;
  const barra = (i: ItemPlano, s: { inicio: string; fim: string }) => {
    const dentro = i.inicio <= s.fim && i.fim >= s.inicio;
    if (!dentro) return null;
    return i.marco ? <div className="mx-auto h-3 w-3 rotate-45 bg-m-warning" title={`Marco ${dataBR(i.fim)}`} />
      : <div className={`h-3 ${BARRA[i.situacao]} ${i.inicio >= s.inicio ? 'rounded-l-full' : ''} ${i.fim <= s.fim ? 'rounded-r-full' : ''}`} title={`${dataBR(i.inicio)} a ${dataBR(i.fim)}`} />;
  };
  const linha = (i: ItemPlano) => {
    n += 1;
    return (
      <Fragment key={i.id}>
      <tr onClick={() => onSel(i.id)} style={n % 2 === 0 ? { background: 'var(--m-zebra-programacao)' } : undefined}
        className={`cursor-pointer border-b border-m-row align-top hover:outline hover:outline-1 hover:outline-m-accent ${sel === i.id ? 'outline outline-2 outline-m-accent' : ''}`}>
        <td className="px-2 py-1.5 text-m-text-muted">{n}</td>
        <td className="min-w-[420px] px-2 py-1.5">
          <span className="font-medium text-m-text-primary">{i.marco && <Diamond size={12} className="mr-1 inline text-m-warning" />}{i.cwp?.texto ? i.descricao.replace(` - (${i.cwp.texto})`, '') : i.descricao}</span>
          {i.etapa && <span className={`ml-1 rounded-[5px] px-1.5 py-px text-[10px] font-semibold ${i.etapa.sem_avanco ? 'bg-m-warning-subtle text-m-warning' : 'bg-m-accent-subtle text-m-accent'}`}>{i.etapa.sem_avanco ? 'sem avanço' : `etapa ${fmt((i.etapa.percentual ?? 0) * 100, 2)}%`}</span>}
          <div className="text-[11px] text-m-text-muted">
            {i.wbs_codigo ? <span className="mr-1 rounded-[5px] bg-m-info-subtle px-1.5 py-px font-semibold text-m-info">WBS {i.wbs_codigo}</span> : <span className="mr-1 rounded-[5px] bg-m-surface-active px-1.5 py-px">livre</span>}
            {i.codigo} · {dataBR(i.inicio)}{i.fim !== i.inicio ? ` a ${dataBR(i.fim)}` : ''}{i.id_crono ? ` · P6 ${i.id_crono}` : i.wbs_no_id ? ' · fora do cronograma' : ''}{i.recursos.length ? ` · ${i.recursos.length} recurso(s) P6` : ''}
            {i.status_crono === 'Concluída' && <span className="ml-1.5 font-semibold text-m-success">concluída no cronograma</span>}
          </div>
        </td>
        <td className="px-2 py-1.5 whitespace-nowrap">{i.item_pq ?? '—'}</td>
        <td className="px-2 py-1.5">{i.equipe ?? <span className="text-m-text-muted">—</span>}</td>
        <td className="whitespace-nowrap px-2 py-1.5 text-right">{i.quantidade != null ? `${fmt(i.quantidade)} ${i.unidade ?? ''}` : '—'}</td>
        <td className="px-2 py-1.5">{!i.marco && <Pilula tom={TOM[i.situacao]}>{ROTULO[i.situacao]}</Pilula>}</td>
        {seis && <td className="whitespace-nowrap px-2 py-1.5 text-[12px]">{i.marco ? '' : i.pendentes ? <span className="text-m-danger">{i.pendentes} pendente(s)</span> : i.analisado ? 'nenhuma' : <span className="text-m-text-muted">não analisado</span>}</td>}
        {semanas.map((s) => <td key={s.inicio} className="px-0.5 py-2">{barra(i, s)}</td>)}
      </tr>
      {/* spec 084: restrições e detalhes abrem logo abaixo da atividade clicada */}
      {sel === i.id && detalhe && <tr><td colSpan={colunas} className="border-b border-m-accent bg-m-accent-subtle/20 px-2 py-2"><div className="sticky left-2 max-w-[min(1100px,calc(100vw-80px))]">{detalhe}</div></td></tr>}
      </Fragment>
    );
  };
  const recolher = (nivel: 'local' | 'area' | null) => setFechados(new Set(nivel === null ? [] : estrutura.locais.flatMap(({ l, areas }) =>
    nivel === 'local' ? [`L:${l}`] : areas.map(({ a }) => `A:${l}|${a}`))));
  const total = (areas: { cwps: { itens: ItemPlano[] }[] }[]) => areas.reduce((s, a) => s + a.cwps.reduce((x, c) => x + c.itens.length, 0), 0);
  const seta = (k: string) => (fechados.has(k) ? '▸' : '▾');
  return (
    <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
      <span className="text-m-text-muted">Estrutura:</span>
      <Botao variante="secundario" onClick={() => recolher(null)}>Abrir tudo</Botao>
      <Botao variante="secundario" onClick={() => recolher('area')}>Até a área</Botao>
      <Botao variante="secundario" onClick={() => recolher('local')}>Só locais</Botao>
    </div>
    <div className="overflow-x-auto rounded-m-lg border border-m-stroke-subtle bg-m-surface-raised">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-[0.3px] text-m-text-muted">
            <th className="px-2 py-2">Nº</th><th className="px-2 py-2">Atividade</th><th className="px-2 py-2">Item PQ</th><th className="px-2 py-2">Equipe</th>
            <th className="px-2 py-2 text-right">Quantidade</th><th className="px-2 py-2">Situação</th>{seis && <th className="px-2 py-2">Restrições</th>}
            {semanas.map((s) => <th key={s.inicio} className={`min-w-[48px] px-1 py-2 text-center ${s.inicio <= h && h <= s.fim ? 'text-m-accent' : ''}`}>{dm(s.inicio)}</th>)}
          </tr>
        </thead>
        <tbody>
          {estrutura.marcos.length > 0 && <>
            <tr><td colSpan={colunas} className="bg-m-warning-subtle px-3 py-1.5 text-xs font-bold uppercase tracking-[0.4px] text-m-warning">◆ Marcos</td></tr>
            {estrutura.marcos.map(linha)}
          </>}
          {estrutura.locais.map(({ l, areas }) => (
            <Fragment key={l}>
              <tr onClick={() => alternar(`L:${l}`)} className="cursor-pointer"><td colSpan={colunas} className="bg-[#FF0000] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.4px] text-white">
                <span aria-hidden="true" className="mr-1.5 inline-block w-3">{seta(`L:${l}`)}</span>{l}<span className="ml-2 font-normal normal-case opacity-80">{total(areas)} atividade(s)</span></td></tr>
              {!fechados.has(`L:${l}`) && areas.map(({ a, cwps }) => (
                <Fragment key={a}>
                  <tr onClick={() => alternar(`A:${l}|${a}`)} className="cursor-pointer"><td colSpan={colunas} className="border-b border-m-stroke-subtle bg-[#173761] px-3 py-1.5 text-xs font-semibold text-white">
                    <span aria-hidden="true" className="mr-1.5 inline-block w-3">{seta(`A:${l}|${a}`)}</span>{a}<span className="ml-2 font-normal opacity-80">{total([{ cwps }])}</span><PilulaProjetos s={projetosDa(cwps[0]?.itens[0]?.area_id)} /></td></tr>
                  {!fechados.has(`A:${l}|${a}`) && cwps.map(({ c, itens }) => (
                    <Fragment key={c || '—'}>
                      {c && <tr onClick={() => alternar(`C:${l}|${a}|${c}`)} className="cursor-pointer"><td colSpan={colunas} className="border-b border-m-stroke-subtle bg-m-surface-active px-3 py-1 text-[11.5px] font-semibold text-m-text-primary">
                        <span aria-hidden="true" className="mr-1.5 inline-block w-3">{seta(`C:${l}|${a}|${c}`)}</span>CWP · {c}<span className="ml-2 font-normal text-m-text-muted">{itens.length}</span></td></tr>}
                      {!(c && fechados.has(`C:${l}|${a}|${c}`)) && itens.map(linha)}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
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
  const projeto = useSituacaoProjetos()(item.area_id);
  const pedir = (p: Promise<unknown>, ok: string) => p.then(() => { toast.success(ok); atualizar(); }).catch((e) => toast.error(e.message));
  if (editar) return <FormItem item={item} marcos={marcos} onFechar={() => setEditar(false)} />;
  return (
    <Painel titulo={`${item.codigo} · ${item.descricao}`}
      subtitulo={`${item.marco ? 'Marco' : ROTULO[item.situacao]}${item.id_crono ? ` · ${item.id_crono}${item.status_crono ? ` (${item.status_crono.toLowerCase()} no cronograma)` : ''}` : ''} · ${dataBR(item.inicio)} a ${dataBR(item.fim)}${item.area ? ` · ${item.area}` : ''}${item.equipe ? ` · ${item.equipe}` : ''}`}
      acoes={<div className="flex gap-2">
        {pode('planejador') && <Botao variante="secundario" onClick={() => setEditar(true)}>Editar</Botao>}
        {pode('planejador') && <Botao variante="excluir" aria-label="Excluir item" onClick={async () => (await confirmar({ titulo: `Excluir ${item.codigo}?`, mensagem: item.descricao }))
          && api.del(`/planos/itens/${item.id}`).then(() => { toast.success('Item excluído'); atualizar(); onFechar(); }).catch((e) => toast.error(e.message))}><Trash2 size={15} /></Botao>}
        <Botao variante="fantasma" aria-label="Fechar" onClick={onFechar}><X size={16} /></Botao>
      </div>}>
      {item.programacoes.length > 0 && <p className="text-[13px] text-m-text-secondary">Na programação: {item.programacoes.map((p, k) => <Fragment key={p.id}>{k ? ', ' : ''}<Link href={`/app/programacoes/${p.id}`} className="font-semibold text-m-accent underline">{p.titulo}</Link></Fragment>)}</p>}
      {item.recursos.length > 0 && <Recursos recursos={item.recursos} />}
      {!item.marco && projeto && !projeto.libera && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-m-md border border-m-warning bg-m-warning-subtle px-3 py-2 text-[13px]">
          <span className="text-m-text-primary">Projeto da frente: <b>{projeto.ativos.map((a) => a.status_texto ?? projeto.rotulo).join(' · ')}</b>
            <PilulaProjetos s={projeto} /></span>
          {pode('encarregado') && <button type="button" className="font-semibold text-m-accent" onClick={() => setR({ ...r, seis_m: 'MET', impeditivo: true,
            acao: `Liberar os projetos da frente ${item.area ?? ''} (${projeto.rotulo.toLowerCase()} no controle por ativo)` })}>Preencher restrição de projeto</button>}
        </div>
      )}
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

/** Inserir pela WBS (spec 081): marque áreas, CWPs, grupos, IWPs ou etapas — vão os IWPs (ou as etapas deles) abaixo,
 * inclusive os que não estão no cronograma (para esses, informe a janela). */
function FormDaWbs({ marcos, onFechar }: { marcos: ItemPlano[]; onFechar: () => void }) {
  const api = useApi();
  const atualizar = useAtualizar();
  const wbs = useWbs();
  const equipes = useEquipes();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const [busca, setBusca] = useState('');
  const [f, setF] = useState({ inicio: '', fim: '', equipe_id: '', marco_id: '' });
  const arvore = wbs.data?.arvore ?? [];
  const marcar = (id: number) => setSel((x) => { const n2 = new Set(x); if (n2.has(id)) n2.delete(id); else n2.add(id); return n2; });
  const t = busca.trim().toLowerCase();
  const casa = (n: NoWbs): boolean => !t || [n.codigo, n.titulo, n.detalhe, n.id_crono ?? ''].join(' ').toLowerCase().includes(t) || n.filhos.some(casa);
  const semCrono = (n: NoWbs): number => (n.tipo === 'iwp' || n.tipo === 'etapa' ? (n.id_crono ? 0 : 1) : 0) + n.filhos.reduce((s, x) => s + semCrono(x), 0);
  const marcadosSemCrono = [...sel].some((id) => { const ach = (ns: NoWbs[]): NoWbs | undefined => { for (const x of ns) { if (x.id === id) return x; const y = ach(x.filhos); if (y) return y; } return undefined; }; const n2 = ach(arvore); return !!n2 && semCrono(n2) > 0; });
  const no = (n: NoWbs, nivel: number): React.ReactNode => {
    if (!casa(n) || !n.ativo) return null;
    const aberto = !!t || abertos.has(n.id);
    return (
      <Fragment key={n.id}>
        <div className="flex items-center gap-1.5 border-b border-m-stroke-subtle py-1 text-[12.5px]" style={{ paddingLeft: 4 + nivel * 16 }}>
          {n.filhos.length ? <button type="button" aria-label={aberto ? 'Recolher' : 'Abrir'} onClick={() => setAbertos((x) => { const y = new Set(x); if (y.has(n.id)) y.delete(n.id); else y.add(n.id); return y; })} className="w-4 text-m-text-muted">{aberto ? '▾' : '▸'}</button> : <span className="w-4" />}
          <input type="checkbox" checked={sel.has(n.id)} onChange={() => marcar(n.id)} aria-label={`Marcar ${n.codigo}`} />
          <b className="whitespace-nowrap text-m-text-primary">{n.codigo}</b>
          <span className="min-w-0 truncate">{n.titulo}</span>
          {n.tipo === 'etapa' && n.sem_avanco && <Pilula tom="atencao">sem avanço</Pilula>}
          {(n.tipo === 'iwp' || n.tipo === 'etapa') && (n.id_crono ? <span className="text-[11px] text-m-text-muted">P6 {n.id_crono}</span> : <span className="text-[11px] text-m-warning">fora do cronograma</span>)}
        </div>
        {aberto && n.filhos.map((x) => no(x, nivel + 1))}
      </Fragment>
    );
  };
  return (
    <Painel titulo="Inserir atividades pela WBS" subtitulo="marque o que entra no plano: áreas, CWPs, grupos, IWPs ou etapas (IWP com etapas entra como as etapas)">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-2">
          <Campo rotulo="Buscar na WBS" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="código, CWP, item da PQ, atividade do P6" />
          <div className="max-h-[420px] overflow-y-auto rounded-[10px] border border-m-stroke-subtle px-2">{wbs.isLoading ? <p className="p-3 text-sm text-m-text-muted">Carregando a WBS…</p> : arvore.map((x) => no(x, 0))}</div>
        </div>
        <form className="flex flex-col gap-3" onSubmit={(e) => {
          e.preventDefault();
          api.post<{ criados: number; ja_estavam: number; sem_data: number; nos_sem_iwp: number[] }>('/planos/itens/da-wbs', { nos: [...sel], inicio: f.inicio || null, fim: f.fim || null,
            equipe_id: f.equipe_id ? Number(f.equipe_id) : null, marco_id: f.marco_id ? Number(f.marco_id) : null })
            .then((r) => { toast.success(`${r.criados} atividade(s) no plano${r.ja_estavam ? ` · ${r.ja_estavam} já estavam` : ''}`); if (r.sem_data) toast.warning(`${r.sem_data} fora do cronograma sem datas: informe início e fim e insira de novo`); atualizar(); if (!r.sem_data) onFechar(); })
            .catch((er) => toast.error(er.message));
        }}>
          <span className="text-[13px] text-m-text-secondary">{sel.size} nó(s) marcado(s)</span>
          <Campo rotulo={`Início${marcadosSemCrono ? '' : ' (vazio = do cronograma)'}`} type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />
          <Campo rotulo={`Fim${marcadosSemCrono ? '' : ' (vazio = do cronograma)'}`} type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} />
          {marcadosSemCrono && <span className="text-[12px] text-m-warning">Há itens fora do cronograma: sem início e fim eles não entram.</span>}
          <Selecao rotulo="Equipe" value={f.equipe_id} onChange={(e) => setF({ ...f, equipe_id: e.target.value })}><option value="">—</option>{equipes.data?.filter((e) => e.ativo).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</Selecao>
          <Selecao rotulo="Puxada pelo marco" value={f.marco_id} onChange={(e) => setF({ ...f, marco_id: e.target.value })}><option value="">—</option>{marcos.map((m) => <option key={m.id} value={m.id}>{m.codigo} · {m.descricao}</option>)}</Selecao>
          <div className="flex gap-2"><Botao type="submit" disabled={!sel.size}>Inserir no plano</Botao><Botao type="button" variante="secundario" onClick={onFechar}>Fechar</Botao></div>
        </form>
      </div>
    </Painel>
  );
}

function Migrar() {
  const api = useApi();
  const atualizar = useAtualizar();
  const { pode } = useObra();
  const progs = useProgramacoes();
  const abertas = (progs.data ?? []).filter((p) => p.status === 'rascunho');
  const [escolhida, setPid] = useState<number | null>(null);
  // spec 085: sem escolha, vai a programação em rascunho de hoje (semanal antes da mensal)
  const h = hoje();
  const distancia = (p: { inicio: string; fim: string }) => (p.inicio <= h && h <= p.fim ? 0 : Math.abs(new Date(p.inicio).getTime() - new Date(h).getTime()));
  const corrente = abertas.find((p) => p.tipo === 'SEMANAL' && p.inicio <= h && h <= p.fim) ?? abertas.find((p) => p.inicio <= h && h <= p.fim)
    ?? [...abertas].sort((a, b) => distancia(a) - distancia(b))[0]; // sem a de hoje: a em rascunho mais perto de hoje
  const pid = escolhida ?? corrente?.id ?? null;
  const [soCorrente, setSoCorrente] = useState(true);
  const previa = useQuery({ queryKey: ['plano-migrar', pid], enabled: !!pid, queryFn: () => api.get<PreviaMigracao>(`/planos/migrar/${pid}`) });
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [qtd, setQtd] = useState<Record<number, string>>({});
  const [res, setRes] = useState<{ criadas: number; bloqueados: string[]; avisos: string[] } | null>(null);
  const lista = previa.data?.itens ?? [];
  const semanal = previa.data?.programacao.tipo === 'SEMANAL';
  const semanas = useMemo(() => semanasDoPeriodo(previa.data?.programacao.inicio, previa.data?.programacao.fim), [previa.data]);
  const semCorrente = semanas.find((s) => s.inicio <= h && h <= s.fim) ?? semanas[0];
  // cada atividade entra na 1ª semana do período em que ela acontece
  const porSemana = useMemo(() => semanas.map((s) => ({ ...s, itens: lista.filter((i) => {
    const ini = i.inicio > (semanas[0]?.inicio ?? '') ? i.inicio : semanas[0]?.inicio ?? i.inicio;
    return ini >= s.inicio && ini <= s.fim;
  }) })), [semanas, lista]);
  const podeLevar = (i: (typeof lista)[number]) => !i.ja_na_programacao && i.migravel && !(semanal && i.pendentes);
  const marcarSemana = (its: typeof lista) => setMarcados((m) => { const n = new Set(m); its.filter(podeLevar).forEach((i) => n.add(i.id)); return n; });
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
        {semanas.length > 1 && <label className="flex items-center gap-1.5 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={soCorrente} onChange={(e) => setSoCorrente(e.target.checked)} /> só a semana corrente</label>}
      </div>
      {!pid && <p className="text-[13px] text-m-text-muted">Nenhuma programação em rascunho: crie a semanal em Programações para levar as atividades.</p>}
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
              {porSemana.filter((s) => s.itens.length && (!soCorrente || semanas.length < 2 || s.inicio === semCorrente?.inicio)).map((s) => (
                <Fragment key={s.inicio}>
                  <tr><td colSpan={6} className={`px-2 py-1.5 text-[12px] font-semibold ${s.inicio === semCorrente?.inicio ? 'bg-m-accent-subtle text-m-accent' : 'bg-m-surface-active text-m-text-primary'}`}>
                    <span className="flex flex-wrap items-center gap-3">Semana {s.numero} · {dm(s.inicio)} a {dm(s.fim)}{s.inicio === semCorrente?.inicio ? ' · corrente' : ''} · {s.itens.length} atividade(s)
                      {pode('encarregado') && s.itens.some(podeLevar) && <button type="button" className="font-semibold underline" onClick={() => marcarSemana(s.itens)}>marcar a semana</button>}</span>
                  </td></tr>
                  {s.itens.map((i) => {
                const pode_ = podeLevar(i);
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
                </Fragment>
              ))}
              {!lista.length && !previa.isLoading && <tr><td colSpan={6} className="px-2 py-6 text-center text-m-text-muted">Nenhuma atividade do plano cai no período desta programação.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Painel>
  );
}

const TIPO_RECURSO: Record<RecursoP6['tipo'], string> = { mao_de_obra: 'Mão de obra', equipamento: 'Equipamento', material: 'Material', outro: 'Outro' };

/** Recursos alocados na atividade do P6 (TASKRSRC): quantidade orçada e restante, como estão no cronograma. */
function Recursos({ recursos }: { recursos: RecursoP6[] }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[14px] font-semibold text-m-text-primary">Recursos alocados no cronograma (P6)</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead><tr className="text-left text-[11px] uppercase tracking-[0.3px] text-m-text-muted">
            <th className="px-2 py-1.5">Recurso</th><th className="px-2 py-1.5">Tipo</th><th className="px-2 py-1.5 text-right">Orçado</th><th className="px-2 py-1.5 text-right">Restante</th>
          </tr></thead>
          <tbody>
            {[...recursos].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome)).map((r, k) => (
              <tr key={`${r.codigo}-${k}`} className="border-b border-m-row">
                <td className="px-2 py-1.5 text-m-text-primary">{r.nome}{r.codigo && <span className="ml-1.5 text-[11px] text-m-text-muted">{r.codigo}</span>}</td>
                <td className="px-2 py-1.5">{TIPO_RECURSO[r.tipo]}</td>
                <td className="px-2 py-1.5 text-right">{r.qtd != null ? `${fmt(r.qtd)} ${r.unid ?? ''}` : '—'}</td>
                <td className="px-2 py-1.5 text-right">{r.restante != null ? `${fmt(r.restante)} ${r.unid ?? ''}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Puxar do cronograma vigente as atividades de um período (com área, IWP e recursos do P6). */
function FormDoCronograma({ marcos, onFechar }: { marcos: ItemPlano[]; onFechar: () => void }) {
  const api = useApi();
  const atualizar = useAtualizar();
  const equipes = useEquipes();
  const [f, setF] = useState({ inicio: hoje(), fim: somaDias(hoje(), 90), excluir_concluidas: true, so_construcao: true, busca: '', equipe_id: '', marco_id: '' });
  const [pv, setPv] = useState<{ atividades: AtividadePeriodo[]; total: number; concluidas_excluidas: number; fora_da_construcao: number } | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const corpo = () => ({ inicio: f.inicio, fim: f.fim, excluir_concluidas: f.excluir_concluidas, so_construcao: f.so_construcao, busca: f.busca || null });
  const verPrevia = (e?: React.FormEvent) => {
    e?.preventDefault();
    setCarregando(true);
    api.post<typeof pv>('/planos/cronograma/previa', corpo())
      .then((r) => { setPv(r); setMarcadas(new Set(r!.atividades.filter((a) => !a.no_plano).map((a) => a.id_crono))); })
      .catch((er) => toast.error(er.message)).finally(() => setCarregando(false));
  };
  const puxar = () => api.post<{ novos: number; atualizados: number; recusadas?: string[] }>('/planos/itens/do-cronograma', { ...corpo(), ids: [...marcadas],
    equipe_id: f.equipe_id ? Number(f.equipe_id) : null, marco_id: f.marco_id ? Number(f.marco_id) : null })
    .then((r) => {
      toast.success(`${r.novos} atividade(s) no plano${r.atualizados ? ` · ${r.atualizados} atualizada(s) pelo cronograma` : ''}`);
      // spec 109: a que não passa fica de fora e avisa, sem derrubar as outras
      if (r.recusadas?.length) toast.warning(`${r.recusadas.length} ficou(aram) de fora: ${r.recusadas.slice(0, 3).join(' · ')}${r.recusadas.length > 3 ? '…' : ''}`, { duration: 12000 });
      atualizar(); onFechar();
    })
    .catch((er) => toast.error(er.message));
  const lista = pv?.atividades ?? [];
  const todas = lista.length > 0 && lista.every((a) => marcadas.has(a.id_crono));
  return (
    <Painel titulo="Puxar do cronograma (período)" acoes={<Botao variante="fantasma" aria-label="Fechar" onClick={onFechar}><X size={16} /></Botao>}>
      <form onSubmit={verPrevia} className="grid gap-3 md:grid-cols-6 md:items-end">
        <Campo rotulo="De" type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} required />
        <Campo rotulo="Até" type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} required />
        <div className="md:col-span-2"><Campo rotulo="Filtrar (ID, atividade ou WBS)" value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} /></div>
        <label className="flex items-center gap-1.5 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={f.excluir_concluidas} onChange={(e) => setF({ ...f, excluir_concluidas: e.target.checked })} /> Excluir concluídas</label>
        <label className="flex items-center gap-1.5 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={f.so_construcao} onChange={(e) => setF({ ...f, so_construcao: e.target.checked })} /> Só construção (CWP)</label>
        <Selecao rotulo="Equipe (opcional)" value={f.equipe_id} onChange={(e) => setF({ ...f, equipe_id: e.target.value })}><option value="">—</option>{equipes.data?.filter((e) => e.ativo).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</Selecao>
        <Selecao rotulo="Puxada pelo marco (opcional)" value={f.marco_id} onChange={(e) => setF({ ...f, marco_id: e.target.value })}><option value="">—</option>{marcos.map((m) => <option key={m.id} value={m.id}>{m.codigo} · {m.descricao}</option>)}</Selecao>
        <div className="flex gap-2 md:col-span-4"><Botao type="submit" variante="secundario" disabled={carregando}><CalendarSearch size={16} /> {carregando ? 'Buscando…' : 'Ver atividades do período'}</Botao></div>
      </form>
      {pv && <>
        <p className="text-[12.5px] text-m-text-muted">{pv.total} atividade(s) no período{pv.concluidas_excluidas ? ` · ${pv.concluidas_excluidas} concluída(s) deixada(s) de fora` : ''}{pv.fora_da_construcao ? ` · ${pv.fora_da_construcao} fora da construção` : ''}{pv.total > lista.length ? ` · mostrando ${lista.length}: filtre para ver o resto` : ''}. Atividade já no plano é atualizada (datas e recursos).</p>
        <div className="max-h-[420px] overflow-auto rounded-m-md border border-m-stroke-subtle">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 bg-m-surface-raised"><tr className="text-left text-[11px] uppercase tracking-[0.3px] text-m-text-muted">
              <th className="px-2 py-2"><input type="checkbox" aria-label="Marcar todas" checked={todas} onChange={() => setMarcadas(todas ? new Set() : new Set(lista.map((a) => a.id_crono)))} /></th>
              <th className="px-2 py-2">Atividade</th><th className="px-2 py-2">Área</th><th className="px-2 py-2">Janela</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Recursos</th>
            </tr></thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id_crono} className="border-b border-m-row">
                  <td className="px-2 py-1.5"><input type="checkbox" aria-label={`Puxar ${a.id_crono}`} checked={marcadas.has(a.id_crono)}
                    onChange={() => setMarcadas((m) => { const n = new Set(m); if (n.has(a.id_crono)) n.delete(a.id_crono); else n.add(a.id_crono); return n; })} /></td>
                  <td className="px-2 py-1.5"><div className="text-m-text-primary">{a.atividade}</div><div className="text-[11px] text-m-text-muted">{a.id_crono} · {a.caminho}{a.wbs_no_id ? ' · IWP na WBS' : ''}{a.no_plano ? ' · já no plano' : ''}</div></td>
                  <td className="px-2 py-1.5">{a.area ?? <span className="text-m-warning">sem área</span>}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{dm(a.inicio)} a {dm(a.fim)}</td>
                  <td className="px-2 py-1.5">{a.status}</td>
                  <td className="px-2 py-1.5" title={a.recursos.map((r) => `${r.nome}: ${fmt(r.qtd)} ${r.unid ?? ''}`).join('\n')}>{a.recursos.length ? `${a.recursos.length} (${[...new Set(a.recursos.map((r) => TIPO_RECURSO[r.tipo].toLowerCase()))].join(', ')})` : '—'}</td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={6} className="px-2 py-6 text-center text-m-text-muted">Nenhuma atividade no período.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2"><Botao disabled={!marcadas.size} onClick={puxar}><GanttChart size={16} /> Puxar {marcadas.size} atividade(s)</Botao></div>
      </>}
    </Painel>
  );
}

interface LinhaDaProgramacao { linha_id: number; descricao: string; area: string; equipe: string | null; id_crono: string | null; wbs_no_id: number | null;
  inicio: string; fim: string; quantidade: number | null; unidade: string | null; no_plano: number | null }

/** Spec 084: as linhas da programação corrente (ou de outra) viram atividades do plano e ficam ligadas a elas. */
function FormDaProgramacao({ onFechar }: { onFechar: () => void }) {
  const api = useApi();
  const atualizar = useAtualizar();
  const progs = useProgramacoes();
  const [pid, setPid] = useState('');
  const pv = useQuery({ queryKey: ['plano', 'da-programacao', pid], queryFn: () => api.get<{ programacao: { id: number; titulo: string; status: string }; linhas: LinhaDaProgramacao[] }>(
    `/planos/programacao/previa${pid ? `?pid=${pid}` : ''}`) });
  const [marcadas, setMarcadas] = useState<Set<number> | null>(null);
  const lista = pv.data?.linhas ?? [];
  const sel = marcadas ?? new Set(lista.filter((x) => !x.no_plano).map((x) => x.linha_id));
  const novas = lista.filter((x) => !x.no_plano);
  const puxar = () => api.post<{ novos: number; ligados: number; ja_estavam: number; programacao: string }>('/planos/itens/da-programacao', {
    programacao_id: pv.data?.programacao.id, linhas: [...sel] })
    .then((r) => { toast.success(`${r.novos} atividade(s) no plano a partir de ${r.programacao}${r.ligados ? ` · ${r.ligados} ligada(s) ao que já estava` : ''}`); atualizar(); onFechar(); })
    .catch((er) => toast.error(er.message));
  return (
    <Painel titulo="Puxar da programação" subtitulo="Cada linha vira atividade do plano com a janela dos dias previstos, a equipe e a quantidade do período, e fica ligada a ela (sai como programada). O que já está no plano não duplica."
      acoes={<Botao variante="fantasma" aria-label="Fechar" onClick={onFechar}><X size={16} /></Botao>}>
      <div className="flex flex-wrap items-end gap-2">
        <Selecao rotulo="Programação" value={pid} onChange={(e) => { setPid(e.target.value); setMarcadas(null); }} className="min-w-[340px]">
          <option value="">Corrente{pv.data && !pid ? ` (${pv.data.programacao.titulo})` : ''}</option>
          {progs.data?.map((p) => <option key={p.id} value={p.id}>{p.titulo} · {p.status}</option>)}
        </Selecao>
        <Botao disabled={!sel.size} onClick={puxar}><CalendarDays size={16} /> Puxar {sel.size} linha(s)</Botao>
        <span className="text-[12.5px] text-m-text-muted">{lista.length} linha(s) · {novas.length} ainda fora do plano</span>
      </div>
      {pv.isLoading && <Carregando />}
      {pv.error && <p className="text-sm text-m-danger">{(pv.error as Error).message}</p>}
      {lista.length > 0 && (
        <div className="max-h-[420px] overflow-auto rounded-m-md border border-m-stroke-subtle">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 bg-m-surface-raised"><tr className="text-left text-[11px] uppercase tracking-[0.3px] text-m-text-muted">
              <th className="px-2 py-2"><input type="checkbox" aria-label="Marcar todas" checked={sel.size === lista.length}
                onChange={() => setMarcadas(sel.size === lista.length ? new Set() : new Set(lista.map((x) => x.linha_id)))} /></th>
              <th className="px-2 py-2">Atividade</th><th className="px-2 py-2">Área</th><th className="px-2 py-2">Equipe</th><th className="px-2 py-2">Janela</th><th className="px-2 py-2 text-right">Qtd. do período</th>
            </tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.linha_id} className="border-b border-m-row">
                  <td className="px-2 py-1.5"><input type="checkbox" aria-label={`Puxar ${x.descricao}`} checked={sel.has(x.linha_id)}
                    onChange={() => { const n = new Set(sel); if (n.has(x.linha_id)) n.delete(x.linha_id); else n.add(x.linha_id); setMarcadas(n); }} /></td>
                  <td className="px-2 py-1.5"><div className="text-m-text-primary">{x.descricao}</div><div className="text-[11px] text-m-text-muted">{x.id_crono ? `P6 ${x.id_crono}` : ''}{x.wbs_no_id ? ' · IWP' : ''}{x.no_plano ? ' · já no plano (só liga)' : ''}</div></td>
                  <td className="px-2 py-1.5">{x.area}</td>
                  <td className="px-2 py-1.5">{x.equipe ?? '—'}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{dm(x.inicio)} a {dm(x.fim)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">{x.quantidade != null ? `${fmt(x.quantidade)} ${x.unidade ?? ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Painel>
  );
}

/** Semanas (segunda a domingo) que o período da programação cobre, com o número da semana ISO. */
function semanasDoPeriodo(ini?: string, fim?: string) {
  if (!ini || !fim) return [] as { inicio: string; fim: string; numero: number }[];
  const out: { inicio: string; fim: string; numero: number }[] = [];
  let d = new Date(`${ini}T12:00:00`);
  const f = new Date(`${fim}T12:00:00`);
  while (d <= f) {
    const seg = new Date(d); seg.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
    const qui = new Date(seg); qui.setDate(seg.getDate() + 3);
    const jan4 = new Date(qui.getFullYear(), 0, 4);
    const numero = 1 + Math.round(((qui.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
    const s = d.toISOString().slice(0, 10) > ini ? d.toISOString().slice(0, 10) : ini;
    const e = dom > f ? fim : dom.toISOString().slice(0, 10);
    out.push({ inicio: s, fim: e, numero });
    d = new Date(dom); d.setDate(dom.getDate() + 1);
  }
  return out;
}
