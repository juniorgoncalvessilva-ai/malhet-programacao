'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Unlink, Wand2 } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BuscaAtividadeCrono } from '@/components/Obra/AssociarAtividade';
import { Botao, Cabecalho, Campo, Chip, Indicador, Painel, Pilula, Selecao, Tabela, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';

interface Sugestao { id_crono: string; atividade: string; ja_usada: boolean }
interface NoAssoc {
  id: number; tipo: 'iwp' | 'etapa'; codigo: string; caminho: string; titulo: string; item_pq: string | null; area: string | null; area_id: number | null;
  id_crono: string | null; atividade: string | null; no_cronograma: boolean | null; sem_avanco: boolean; sugestoes: Sugestao[];
}
interface Resp { nos: NoAssoc[]; total: number; ligados: number; atividades: number; atividades_sem_wbs: number; sem_wbs: { id_crono: string; atividade: string; area: string | null }[] }

/** Associar os IDs do cronograma importado (P6) à WBS de execução (spec 080): sugestões, busca e o que ainda falta. */
export default function AssociacaoPage() {
  const api = useApi();
  const qc = useQueryClient();
  const { pode } = useObra();
  const edita = pode('planejador');
  const q = useQuery({ queryKey: ['wbs', 'associacao'], queryFn: () => api.get<Resp>('/wbs/associacao') });
  const [filtro, setFiltro] = useState<'sem' | 'todos' | 'ligados'>('sem');
  const [area, setArea] = useState('');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  const d = q.data;
  const areas = useMemo(() => [...new Map((d?.nos ?? []).filter((n) => n.area_id).map((n) => [n.area_id!, n.area!])).entries()], [d]);
  const t = busca.trim().toLowerCase();
  const lista = (d?.nos ?? []).filter((n) => (filtro === 'todos' || (filtro === 'sem' ? !n.id_crono : !!n.id_crono))
    && (!area || String(n.area_id) === area) && (!t || [n.codigo, n.titulo, n.caminho, n.id_crono, n.atividade, n.item_pq].join(' ').toLowerCase().includes(t)));
  const ligar = async (n: NoAssoc, id: string | null) => {
    try {
      const r = await api.put<{ linhas_atualizadas: number }>(`/wbs/nos/${n.id}/atividade`, { id_crono: id });
      toast.success(id ? `${n.codigo} ligado a ${id}${r.linhas_atualizadas ? ` · ${r.linhas_atualizadas} linha(s) em programações em rascunho` : ''}` : `${n.codigo} desligado`);
      setEditando(null); qc.invalidateQueries({ queryKey: ['wbs'] }); qc.invalidateQueries({ queryKey: ['programacao'] });
    } catch (e) { toast.error((e as Error).message); }
  };
  const aceitarTodas = async () => {
    const alvos = lista.filter((n) => !n.id_crono && n.sugestoes[0] && !n.sugestoes[0].ja_usada);
    for (const n of alvos) await ligar(n, n.sugestoes[0].id_crono);
  };

  return (
    <>
      <Cabecalho eyebrow="Programar · WBS de execução" titulo="Associar cronograma ↔ WBS"
        acoes={<Link href="/app/wbs" className="text-[13px] font-semibold text-m-accent underline">Voltar à WBS</Link>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="IWPs/etapas ligados" valor={d ? `${d.ligados} de ${d.total}` : '—'} tom={d && d.ligados < d.total ? 'atencao' : 'sucesso'} />
        <Indicador rotulo="Atividades no cronograma" valor={d?.atividades ?? '—'} />
        <Indicador rotulo="Atividades sem WBS" valor={d?.atividades_sem_wbs ?? '—'} tom={d?.atividades_sem_wbs ? 'atencao' : undefined} />
        <Indicador rotulo="Com sugestão" valor={d ? d.nos.filter((n) => !n.id_crono && n.sugestoes.length).length : '—'} />
      </div>
      <p className="text-[12.5px] text-m-text-muted">Ligar o IWP (ou a etapa) a uma atividade do P6 leva o ID para as linhas dele nas programações em rascunho. Na própria programação também dá para associar, linha a linha, sem travar o fluxo.</p>
      <Painel titulo="IWPs e etapas da WBS"
        acoes={<div className="flex flex-wrap items-end gap-2">
          <div className="flex gap-1.5 pb-1">
            <Chip ativo={filtro === 'sem'} onClick={() => setFiltro('sem')}>Sem atividade</Chip>
            <Chip ativo={filtro === 'ligados'} onClick={() => setFiltro('ligados')}>Ligados</Chip>
            <Chip ativo={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos</Chip>
          </div>
          <Selecao rotulo="Área" value={area} onChange={(e) => setArea(e.target.value)} className="min-w-[220px]">
            <option value="">Todas</option>{areas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </Selecao>
          <Campo rotulo="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="código, item, atividade" className="w-[220px]" />
          {edita && filtro === 'sem' && <Botao variante="secundario" onClick={aceitarTodas} title="Liga cada um à 1ª sugestão (que ainda não está em uso)"><Wand2 size={15} /> Aceitar 1ª sugestão</Botao>}
        </div>}>
        <Tabela cabecalho={['WBS', 'IWP / etapa', 'Atividade do cronograma', 'Sugestões', '']} vazio={!lista.length && (q.isLoading ? 'Carregando…' : 'Nada com esse filtro.')}>
          {lista.map((n) => (
            <Fragment key={n.id}>
              <tr className="align-top">
                <td className={`${td} whitespace-nowrap font-semibold text-m-text-primary`}>{n.codigo}</td>
                <td className={`${td} max-w-[380px]`}>{n.titulo}{n.sem_avanco && <span className="ml-1"><Pilula tom="atencao">sem avanço</Pilula></span>}
                  <span className="block text-[11.5px] text-m-text-muted">{n.caminho.split(' › ').slice(0, -1).join(' › ')}</span></td>
                <td className={`${td} max-w-[320px]`}>{n.id_crono
                  ? <><b>{n.id_crono}</b> · {n.atividade ?? <span className="text-m-warning">não está no cronograma vigente</span>}</>
                  : <span className="text-m-text-muted">—</span>}</td>
                <td className={td}><span className="flex flex-col gap-1">{n.sugestoes.map((sg) => (
                  <button key={sg.id_crono} type="button" disabled={!edita} onClick={() => ligar(n, sg.id_crono)} title={sg.ja_usada ? 'já ligada a outro nó' : 'ligar'}
                    className="max-w-[340px] truncate rounded-[8px] border border-m-stroke-subtle px-2 py-1 text-left text-[12px] hover:border-m-accent disabled:opacity-60">
                    <b>{sg.id_crono}</b> · {sg.atividade}{sg.ja_usada ? ' (em uso)' : ''}</button>))}</span></td>
                <td className={`${td} whitespace-nowrap text-right`}>{edita && <>
                  <button type="button" onClick={() => setEditando(editando === n.id ? null : n.id)} className="mr-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-m-accent"><Link2 size={13} /> buscar</button>
                  {n.id_crono && <button type="button" onClick={() => ligar(n, null)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-m-danger"><Unlink size={13} /> desligar</button>}
                </>}</td>
              </tr>
              {editando === n.id && <tr><td colSpan={5} className="px-3 pb-3"><BuscaAtividadeCrono areaId={n.area_id} autoFocus onEscolher={(a) => ligar(n, a.id_crono)} /></td></tr>}
            </Fragment>
          ))}
        </Tabela>
      </Painel>
      {!!d?.sem_wbs.length && (
        <Painel titulo={`Atividades do cronograma sem WBS (${d.atividades_sem_wbs})`} subtitulo="ainda não ligadas a nenhum IWP/etapa — use a busca acima ou crie o IWP na WBS">
          <ul className="grid gap-x-6 gap-y-1 text-[12.5px] md:grid-cols-2">
            {d.sem_wbs.slice(0, 120).map((a) => <li key={a.id_crono} className="truncate"><b>{a.id_crono}</b> · {a.atividade}{a.area ? <span className="text-m-text-muted"> · {a.area}</span> : null}</li>)}
          </ul>
        </Painel>
      )}
    </>
  );
}
