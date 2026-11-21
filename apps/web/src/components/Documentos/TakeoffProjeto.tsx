'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightToLine, Check, RefreshCw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Botao, CARREGANDO, Pilula, Tabela, fmt, td, tdNum } from '@/components/Obra/ui';
import { useFrentes2 } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { type ComparacaoTakeoff, type LinhaTakeoff, ORIGEM_TAKEOFF, SITUACAO, type Takeoff } from '@/lib/documentos';
import { useObra } from '@/lib/obra/ObraProvider';

type ItemPq = { item: string; descricao: string; unid: string | null };

const sinal = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;
const UN: Record<string, string> = { ml: 'm', und: 'un', pc: 'un', 'pç': 'un', peca: 'un', 'peça': 'un', ton: 't' };
const un = (u: string | null) => { const x = (u ?? '').trim().toLowerCase().replace('²', '2').replace('³', '3').replace('.', ''); return UN[x] ?? x; };
/** Mesma regra da API (`fator_de_conversao`): quadro/anotação só vai para item na mesma unidade (ou kg ↔ t). */
const compativel = (l: LinhaTakeoff, i: ItemPq) => l.origem === 'camada' || l.origem === 'bloco' || !i.unid || un(l.unidade) === un(i.unid)
  || ['kg|t', 't|kg', 'cm|m', 'mm|m'].includes(`${un(l.unidade)}|${un(i.unid)}`);

function memoriaDelta(l: LinhaTakeoff): MemoriaCalculo {
  return {
    chave: 'delta', titulo: `Diferença para a rev. ${l.anterior?.revisao}`, valor: `${sinal(l.delta ?? 0)} ${l.unidade}`,
    formula: 'quantidade nesta revisão − quantidade na revisão anterior (mesma chave do desenho)',
    passos: [{ descricao: l.chave, conta: `${fmt(l.quantidade)} − ${fmt(l.anterior?.quantidade ?? 0)}`, resultado: `${sinal(l.delta ?? 0)} ${l.unidade}`, destaque: true }],
    fontes: [{ dado: `rev. ${l.revisao}`, valor: `${fmt(l.quantidade)} ${l.unidade}`, origem: l.documento, local: l.chave },
      { dado: `rev. ${l.anterior?.revisao}`, valor: `${fmt(l.anterior?.quantidade ?? 0)} ${l.unidade}`, origem: l.documento, local: l.chave }],
    notas: [],
  };
}

function memoriaDiferenca(c: ComparacaoTakeoff): MemoriaCalculo {
  return {
    chave: 'diferenca', titulo: `Projeto × planilha · PQ ${c.item_pq}`, valor: `${sinal(c.diferenca ?? 0)} ${c.unidade}`,
    formula: 'quantidade do projeto − quantidade do take-off da planilha', notas: [],
    passos: [{ descricao: 'diferença', conta: `${fmt(c.projeto)} − ${fmt(c.planilha ?? 0)}`, resultado: `${sinal(c.diferenca ?? 0)} ${c.unidade}`, destaque: true },
      ...(c.diferenca_pct !== null ? [{ descricao: 'em %', conta: `${fmt(c.diferenca ?? 0)} ÷ ${fmt(c.planilha ?? 0)}`, resultado: `${sinal(c.diferenca_pct)}%`, destaque: false }] : [])],
    fontes: [{ dado: 'projeto', valor: `${fmt(c.projeto)} ${c.unidade}`, origem: 'levantamento dos desenhos', local: null },
      { dado: 'planilha', valor: `${fmt(c.planilha ?? 0)} ${c.unidade}`, origem: 'PQ vigente · aba MC', local: c.tag }],
  };
}

/**
 * Take-off pelo projeto (spec 124): quantidades lidas do desenho (tabela de ferros, resumo de aço, anotações, camadas e
 * blocos), cada uma com a conta e o lugar no desenho. O planejador aceita com o item da PQ e a frente; a comparação mostra
 * projeto × planilha × IWP e leva o total ao IWP. Com `documentoId`, mostra só aquele documento (detalhe).
 */
export function TakeoffProjeto({ documentoId }: { documentoId?: number }) {
  const api = useApi();
  const qc = useQueryClient();
  const confirmar = useConfirmar();
  const { pode } = useObra();
  const planejador = pode('planejador');
  const [todas, setTodas] = useState(false);
  const [medicoes, setMedicoes] = useState(false);
  const q = useQuery({
    queryKey: ['documentos', 'takeoff', documentoId ?? 'todos'],
    queryFn: () => api.get<Takeoff>(`/documentos/takeoff${documentoId ? `?documento_id=${documentoId}` : ''}`),
  });
  const itens = useQuery({ queryKey: ['documentos', 'takeoff', 'itens-pq'], queryFn: () => api.get<ItemPq[]>('/documentos/takeoff/itens-pq'), staleTime: 60_000, enabled: planejador });
  const frentes = useFrentes2();
  const areas = useMemo(() => (frentes.data ?? []).flatMap((l) => l.areas.map((a) => ({ id: a.id, rotulo: `${a.codigo} · ${a.descricao}` }))), [frentes.data]);
  const atualizar = () => qc.invalidateQueries({ queryKey: ['documentos', 'takeoff'] });

  const linhas = (q.data?.linhas ?? []).filter((l) => todas || !documentoId || l.situacao_revisao === 'vigente' || l.situacao_revisao === 'em_analise'
    || !(q.data?.linhas ?? []).some((x) => x.documento_id === l.documento_id && x.situacao_revisao === 'vigente'));
  const principais = linhas.filter((l) => l.origem === 'quadro' || l.origem === 'anotacao');
  const desenho = linhas.filter((l) => l.origem === 'camada' || l.origem === 'bloco');
  const revisoes = [...new Map((q.data?.linhas ?? []).map((l) => [l.revisao_id, l])).values()];

  const decidir = async (l: LinhaTakeoff, corpo: Record<string, unknown>) => {
    try { await api.put(`/documentos/takeoff/${l.id}`, corpo); atualizar(); } catch (e) { toast.error((e as Error).message); }
  };
  const aceitar = (l: LinhaTakeoff) => decidir(l, { situacao: 'aceito', ...(l.item_pq ? {} : l.item_sugerido ? { item_pq: l.item_sugerido } : {}) });
  const reler = async (rid: number) => {
    try { const r = await api.post<{ quantidades: number }>(`/documentos/revisoes/${rid}/takeoff`); toast.success(`${r.quantidades} quantidades lidas do desenho`); atualizar(); } catch (e) { toast.error((e as Error).message); }
  };
  const usarNoIwp = async (c: ComparacaoTakeoff) => {
    const iwp = c.iwps[0];
    if (!(await confirmar({
      titulo: `Usar ${fmt(c.projeto)} ${c.unidade} no IWP ${iwp?.codigo ?? ''}?`, perigo: false, acao: 'Usar no IWP',
      mensagem: iwp?.quantidade != null ? `A quantidade de hoje no IWP (${fmt(iwp.quantidade)} ${c.unidade}) é trocada pela do projeto, com a origem anotada.`
        : 'O IWP passa a usar a quantidade do projeto em vez do take-off da planilha, com a origem anotada.',
    }))) return;
    try { const r = await api.post<{ codigo: string }>('/documentos/takeoff/iwp', { item_pq: c.item_pq, area_id: c.area_id }); toast.success(`IWP ${r.codigo} atualizado`); atualizar(); qc.invalidateQueries({ queryKey: ['wbs'] }); } catch (e) { toast.error((e as Error).message); }
  };

  const linha = (l: LinhaTakeoff) => (
    <tr key={l.id} className={l.situacao === 'descartado' ? 'opacity-50' : undefined}>
      {!documentoId && <td className={td}><b className="text-m-text-primary">{l.documento}</b><div className="text-[11px] text-m-text-muted">rev. {l.revisao}{l.situacao_revisao && ` · ${SITUACAO[l.situacao_revisao].rotulo}`}</div></td>}
      <td className={td}>
        <div className="font-medium text-m-text-primary">{l.descricao}</div>
        <div className="text-[11px] text-m-text-muted">{ORIGEM_TAKEOFF[l.origem]}{documentoId && todas ? ` · rev. ${l.revisao}` : ''}</div>
        {l.avisos.map((a, i) => <div key={i} className="text-[11px] text-m-warning">{a}</div>)}
      </td>
      <td className={tdNum}>
        <Calculado chave="projeto" memoria={() => l.memoria}>{fmt(l.quantidade)}</Calculado> <span className="text-m-text-muted">{l.unidade}</span>
        {l.fator !== 1 && <div className="text-[11px] text-m-text-muted">× {fmt(l.fator, 6)} = {fmt(l.quantidade_final)}</div>}
      </td>
      <td className={td}>
        {l.confere === true && <Pilula tom="sucesso">Conferido</Pilula>}
        {l.confere === false && <Pilula tom="perigo">Não bate</Pilula>}
        {l.delta !== null && l.delta !== 0 && <div className="mt-1 text-[12px]"><Calculado chave="delta" memoria={() => memoriaDelta(l)}>{sinal(l.delta)}</Calculado> desde a rev. {l.anterior?.revisao}</div>}
        {l.nova && <div className="mt-1 text-[12px] text-m-text-muted">nova nesta revisão</div>}
      </td>
      <td className={td}>
        {planejador ? (
          <div className="flex w-[280px] flex-col gap-1">
            <select aria-label="Item da PQ" value={l.item_pq ?? ''} onChange={(e) => decidir(l, { item_pq: e.target.value || null })}
              className="h-9 w-full truncate rounded-[10px] border border-m-stroke bg-m-surface-field px-2 text-[12px]">
              <option value="">{l.item_sugerido ? `sugerido: ${l.item_sugerido} · ${l.sugerido_descricao ?? ''}` : 'item da PQ…'}</option>
              {(itens.data ?? []).filter((i) => i.item === l.item_pq || compativel(l, i)).map((i) => <option key={i.item} value={i.item}>{i.item} · {i.descricao} ({i.unid ?? '—'})</option>)}
            </select>
            <select aria-label="Frente" value={l.area_id ?? ''} onChange={(e) => decidir(l, { area_id: e.target.value ? Number(e.target.value) : null })}
              className="h-9 w-full truncate rounded-[10px] border border-m-stroke bg-m-surface-field px-2 text-[12px]">
              <option value="">frente…</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
            </select>
            {(l.origem === 'camada' || l.origem === 'bloco') && (
              <label className="flex items-center gap-1 text-[12px] text-m-text-muted">fator
                <input aria-label="Fator" type="number" step="any" defaultValue={l.fator} className="h-8 w-24 rounded-[8px] border border-m-stroke bg-m-surface-field px-2 text-[12px]"
                  onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== l.fator) decidir(l, { fator: v }); }} />
              </label>
            )}
          </div>
        ) : <span>{l.item_pq ? `${l.item_pq} · ${l.item_descricao ?? ''}` : '—'}{l.area && <div className="text-[11px] text-m-text-muted">{l.area}</div>}</span>}
      </td>
      <td className={td}>
        {l.situacao === 'aceito' ? <Pilula tom="sucesso">Aceito</Pilula> : l.situacao === 'descartado' ? <Pilula tom="neutro">Descartado</Pilula> : <Pilula tom="atencao">A conferir</Pilula>}
        {planejador && (
          <div className="mt-1 flex gap-1">
            {l.situacao !== 'aceito' && <button type="button" aria-label={`Aceitar ${l.chave}`} title="Aceitar" className="grid h-8 w-8 place-items-center rounded-full text-m-success hover:bg-m-surface-hover" onClick={() => aceitar(l)}><Check size={16} /></button>}
            {l.situacao !== 'descartado' && <button type="button" aria-label={`Descartar ${l.chave}`} title="Descartar" className="grid h-8 w-8 place-items-center rounded-full text-m-text-muted hover:bg-m-surface-hover" onClick={() => decidir(l, { situacao: 'descartado' })}><X size={16} /></button>}
          </div>
        )}
      </td>
    </tr>
  );
  const cab = [...(documentoId ? [] : ['Documento']), 'O que o desenho diz', 'Quantidade', 'Conferência', 'Item da PQ e frente', 'Situação'];
  const comparacao = (q.data?.comparacao ?? []).filter((c) => !documentoId || c.linhas.some((id) => linhas.some((l) => l.id === id)));

  return (
    <div className="flex flex-col gap-4">
      {documentoId && revisoes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-m-text-muted">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> todas as revisões</label>
          {planejador && revisoes.map((r) => <button key={r.revisao_id} type="button" onClick={() => reler(r.revisao_id)} className="flex items-center gap-1 font-semibold text-m-accent"><RefreshCw size={13} /> ler rev. {r.revisao} de novo</button>)}
        </div>
      )}
      <Tabela cabecalho={cab} direita={[documentoId ? 1 : 2]} vazio={q.isLoading ? CARREGANDO : !principais.length && 'Nenhum quadro ou anotação com quantidade encontrado nos desenhos (DWG/DXF). PDF e imagem não são lidos.'}>
        {principais.map(linha)}
      </Tabela>
      {desenho.length > 0 && (
        <div>
          <button type="button" onClick={() => setMedicoes(!medicoes)} className="text-[13px] font-semibold text-m-accent">
            {medicoes ? '▾' : '▸'} Medições do desenho por camada e blocos ({desenho.length}) — na unidade do desenho, informe o fator
          </button>
          {medicoes && <div className="mt-2"><Tabela cabecalho={cab} direita={[documentoId ? 1 : 2]}>{desenho.map(linha)}</Tabela></div>}
        </div>
      )}
      {comparacao.length > 0 && (
        <div>
          <div className="mb-2 text-[13px] font-semibold text-m-text-primary">O projeto bate com o take-off da planilha?</div>
          <Tabela cabecalho={['Item da PQ', 'Frente', 'Projeto', 'Planilha', 'Diferença', 'No IWP', '']} direita={[2, 3, 4, 5]}>
            {comparacao.map((c) => (
              <tr key={`${c.item_pq}-${c.area_id}`}>
                <td className={td}><b className="text-m-text-primary">{c.item_pq}</b><div className="text-[11px] text-m-text-muted">{c.item_descricao}</div></td>
                <td className={td}>{c.area}{c.tag && <div className="text-[11px] text-m-text-muted">TAG {c.tag}</div>}</td>
                <td className={tdNum}><Calculado chave="projeto" memoria={() => c.memorias.projeto}>{fmt(c.projeto)}</Calculado> {c.unidade}</td>
                <td className={tdNum}>{c.planilha !== null ? <><Calculado chave="planilha" memoria={() => c.memorias.planilha}>{fmt(c.planilha)}</Calculado> {c.unidade}</> : '—'}</td>
                <td className={tdNum}>{c.diferenca !== null ? <span className={Math.abs(c.diferenca_pct ?? 0) > 5 ? 'text-m-warning' : undefined}><Calculado chave="diferenca" memoria={() => memoriaDiferenca(c)}>{sinal(c.diferenca)}</Calculado>{c.diferenca_pct !== null && ` (${sinal(c.diferenca_pct)}%)`}</span> : '—'}</td>
                <td className={tdNum}>{c.iwps.length ? c.iwps.map((i) => <div key={i.id}>{i.codigo}: {i.quantidade !== null ? fmt(i.quantidade) : 'take-off'}</div>) : <span className="text-m-warning">sem IWP</span>}</td>
                <td className={td}>{planejador && c.iwps.length === 1 && c.iwp !== c.projeto && <Botao variante="secundario" onClick={() => usarNoIwp(c)}><ArrowRightToLine size={15} /> Usar no IWP</Botao>}
                  {c.iwps.length === 1 && c.iwp === c.projeto && <Pilula tom="sucesso">IWP com o projeto</Pilula>}</td>
              </tr>
            ))}
          </Tabela>
        </div>
      )}
    </div>
  );
}
