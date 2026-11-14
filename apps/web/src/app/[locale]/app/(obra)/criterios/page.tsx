'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Plus, Trash2 } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Abas } from '@/components/Obra/Abas';
import { Botao, Cabecalho, Campo, Chip, Indicador, Painel, Pilula, Tabela, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import { Esqueleto } from '@/components/Obra/Esqueleto';

interface Etapa { id?: number; numero: number; nome: string; documento: string | null; percentual: number; sem_avanco: boolean }
interface Criterio { id: number; codigo: string; item_pq: string | null; descricao: string; origem: string; etapas: Etapa[]; soma: number; itens_pq: number | null; etapas_na_wbs: number }
interface Lista { criterios: Criterio[]; itens_pq: number; itens_cobertos: number }
interface LinhaPq { item: string; descricao: string; unid: string | null; nivel: number; folha: boolean; cms: string | null;
  criterio_id?: number | null; sugestao_id?: number | null; como?: 'vinculo' | 'cms' | 'item' | 'cms_grupo' | null; como_texto?: string | null; opcoes?: number; vinculado?: boolean }
type Filtro = 'todos' | 'sem' | 'com' | 'fora';
const FILTROS: { chave: Filtro; titulo: string }[] = [{ chave: 'todos', titulo: 'Todos' }, { chave: 'sem', titulo: 'Sem critério' }, { chave: 'com', titulo: 'Com critério' }, { chave: 'fora', titulo: 'Não fecham 100%' }];
/** Fundo dos títulos da PQ por nível (1 = capítulo). */
const FUNDO_NIVEL = ['bg-m-accent-subtle', 'bg-m-accent-subtle/70', 'bg-m-accent-subtle/45', 'bg-m-accent-subtle/25', 'bg-m-surface-active/50'];

const pct = (x: number) => `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const fecha = (c: { soma: number; etapas: Etapa[] }) => !c.etapas.length || Math.abs(c.soma - 1) < 0.001;

function memSoma(c: Criterio): MemoriaCalculo {
  return {
    chave: 'soma', titulo: `Soma das etapas · ${c.codigo}`, valor: pct(c.soma), formula: 'Σ percentual das etapas que medem (sem avanço = 0%)',
    passos: [...c.etapas.map((e) => ({ descricao: `${e.numero}. ${e.nome}`, conta: e.sem_avanco ? 'sem avanço (só esforço)' : 'peso no valor do item', resultado: pct(e.percentual), destaque: false })),
      { descricao: 'Total', conta: c.etapas.map((e) => pct(e.percentual)).join(' + ') || '0', resultado: pct(c.soma), destaque: true }],
    fontes: [{ dado: 'Etapas', valor: String(c.etapas.length), origem: c.origem === 'planilha' ? 'Planilha de critérios de medição' : 'Cadastro manual', local: `${c.codigo} · item ${c.item_pq ?? '—'}` }],
    notas: ['O esperado é 100%: a soma mostra quanto do valor do item as etapas medem.'],
  };
}

/** Critério de avanço (spec 079): etapas de cada item da PQ e o peso de cada uma no valor; etapas sem avanço contam só HH. */
export default function CriteriosPage() {
  const api = useApi();
  const qc = useQueryClient();
  const confirmar = useConfirmar();
  const { pode } = useObra();
  const edita = pode('planejador');
  const q = useQuery({ queryKey: ['criterios'], queryFn: () => api.get<Lista>('/criterios') });
  const pq = useQuery({ queryKey: ['criterios', 'pq'], queryFn: () => api.get<{ linhas: LinhaPq[] }>('/criterios/pq') });
  const [aba, setAba] = useState<'pq' | 'catalogo'>('pq');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  // aberto: 'novo' (critério avulso), id do critério (catálogo) ou `pq:<item>` (editar/criar a partir da linha da PQ)
  const [aberto, setAberto] = useState<number | 'novo' | string | null>(null);
  const [idEditando, setIdEditando] = useState<number | null>(null);
  const [f, setF] = useState<{ codigo: string; item_pq: string; descricao: string; etapas: Etapa[] } | null>(null);
  const [importando, setImportando] = useState(false);
  const atualizar = () => qc.invalidateQueries({ queryKey: ['criterios'] });
  const t = busca.trim().toLowerCase();
  const lista = (q.data?.criterios ?? []).filter((c) => !t || [c.codigo, c.item_pq, c.descricao, ...c.etapas.map((e) => e.nome)].join(' ').toLowerCase().includes(t));

  const abrir = (c: Criterio | null, chave?: string, base?: LinhaPq) => {
    setAberto(chave ?? (c ? c.id : 'novo'));
    setIdEditando(c ? c.id : null);
    setF(c ? { codigo: c.codigo, item_pq: c.item_pq ?? '', descricao: c.descricao, etapas: c.etapas.map((e) => ({ ...e })) }
      : { codigo: base?.cms ?? '', item_pq: base?.item ?? '', descricao: base?.descricao ?? '', etapas: [{ numero: 1, nome: '', documento: null, percentual: 1, sem_avanco: false }] });
  };
  const fechar = () => { setAberto(null); setF(null); setIdEditando(null); };
  const vincular = async (item: string, criterio_id: number | null) => {
    try { await api.put(`/criterios/pq/${encodeURIComponent(item)}/vinculo`, { criterio_id }); atualizar(); } catch (e) { toast.error((e as Error).message); }
  };
  const importar = async (arq?: File) => {
    if (!arq) return;
    setImportando(true);
    const fd = new FormData(); fd.append('arquivo', arq);
    try {
      const r = await api.post<{ lidos: number; novos: number; atualizados: number; etapas: number; avisos: string[] }>('/criterios/importar', fd);
      toast.success(`${r.lidos} critério(s) · ${r.novos} novo(s), ${r.atualizados} atualizado(s) · ${r.etapas} etapas`);
      r.avisos.slice(0, 4).forEach((a) => toast.warning(a, { duration: 8000 }));
      atualizar();
    } catch (e) { toast.error((e as Error).message); } finally { setImportando(false); }
  };
  const salvar = async () => {
    if (!f) return;
    const corpo = { ...f, etapas: f.etapas.map((e) => ({ ...e, percentual: e.sem_avanco ? 0 : e.percentual })) };
    try {
      if (idEditando == null) await api.post('/criterios', corpo); else await api.put(`/criterios/${idEditando}`, corpo);
      toast.success('Critério salvo'); fechar(); atualizar();
    } catch (e) { toast.error((e as Error).message); }
  };
  const mudarEtapa = (i: number, m: Partial<Etapa>) => setF((x) => (x ? { ...x, etapas: x.etapas.map((e, j) => (j === i ? { ...e, ...m } : e)) } : x));
  const somaForm = f ? f.etapas.reduce((s, e) => s + (e.sem_avanco ? 0 : e.percentual || 0), 0) : 0;

  const editor = f && (
    <div className="flex flex-col gap-3 rounded-[12px] border border-m-accent bg-m-accent-subtle/30 p-3">
      <div className="flex flex-wrap gap-2">
        <Campo rotulo="Código do critério" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} placeholder="CMS M.75.10.000" className="w-[200px]" />
        <Campo rotulo="Item da PQ (vale para os de baixo)" value={f.item_pq} onChange={(e) => setF({ ...f, item_pq: e.target.value })} placeholder="23.1" className="w-[200px]" />
        <Campo rotulo="Descrição" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} className="min-w-[360px] flex-1" />
      </div>
      <table className="w-full text-[13px]">
        <thead><tr className="text-left text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted">
          <th className="w-[60px] px-1 py-1">Nº</th><th className="px-1 py-1">Etapa</th><th className="w-[150px] px-1 py-1">Sem avanço</th><th className="w-[110px] px-1 py-1 text-right">% do item</th><th className="px-1 py-1">O que comprova (documento)</th><th />
        </tr></thead>
        <tbody>
          {f.etapas.map((e, i) => (
            <tr key={i} className="border-t border-m-stroke-subtle align-top">
              <td className="px-1 py-1"><input aria-label="Número" type="number" value={e.numero} onChange={(ev) => mudarEtapa(i, { numero: Number(ev.target.value) })} className="h-9 w-[54px] rounded-[8px] border border-m-stroke bg-m-surface-field px-2" /></td>
              <td className="px-1 py-1"><input aria-label="Nome da etapa" value={e.nome} onChange={(ev) => mudarEtapa(i, { nome: ev.target.value })} className="h-9 w-full rounded-[8px] border border-m-stroke bg-m-surface-field px-2" /></td>
              <td className="px-1 py-1"><label className="flex h-9 items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={e.sem_avanco} onChange={(ev) => mudarEtapa(i, { sem_avanco: ev.target.checked, percentual: ev.target.checked ? 0 : e.percentual })} /> só esforço (HH)</label></td>
              <td className="px-1 py-1 text-right">{e.sem_avanco ? <span className="leading-9 text-m-text-muted">0%</span>
                : <input aria-label="Percentual" type="number" min="0" max="100" step="any" value={+(e.percentual * 100).toFixed(4)} onChange={(ev) => mudarEtapa(i, { percentual: Number(ev.target.value) / 100 })} className="h-9 w-[90px] rounded-[8px] border border-m-stroke bg-m-surface-field px-2 text-right" />}</td>
              <td className="px-1 py-1"><textarea aria-label="Documento" rows={1} value={e.documento ?? ''} onChange={(ev) => mudarEtapa(i, { documento: ev.target.value })} className="min-h-9 w-full rounded-[8px] border border-m-stroke bg-m-surface-field px-2 py-1.5 text-[12.5px]" /></td>
              <td className="px-1 py-1"><button type="button" aria-label="Tirar a etapa" onClick={() => setF({ ...f, etapas: f.etapas.filter((_, j) => j !== i) })} className="grid h-9 w-9 place-items-center rounded-full border border-m-stroke text-m-text-muted"><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2">
        <Botao variante="secundario" onClick={() => setF({ ...f, etapas: [...f.etapas, { numero: Math.max(0, ...f.etapas.map((e) => e.numero)) + 1, nome: '', documento: null, percentual: 0, sem_avanco: false }] })}><Plus size={15} /> Etapa</Botao>
        <Botao variante="secundario" title="Ex.: pré-armação do aço fora do local de montagem" onClick={() => setF({ ...f, etapas: [{ numero: Math.min(1, ...f.etapas.map((e) => e.numero)) - 1, nome: 'Pré-armação (fora do local)', documento: null, percentual: 0, sem_avanco: true }, ...f.etapas] })}><Plus size={15} /> Etapa sem avanço</Botao>
        <span className={`text-[13px] font-semibold ${Math.abs(somaForm - 1) < 0.001 ? 'text-m-success' : 'text-m-warning'}`}>Soma: {pct(somaForm)}{Math.abs(somaForm - 1) < 0.001 ? '' : ' (o esperado é 100%)'}</span>
        <span className="flex-1" />
        <Botao onClick={salvar}>Salvar</Botao>
        <Botao variante="secundario" onClick={fechar}>Cancelar</Botao>
      </div>
    </div>
  );

  const fora = (q.data?.criterios ?? []).filter((c) => !fecha(c)).length;
  const sugeridas = (pq.data?.linhas ?? []).filter((ln) => ln.folha && !ln.criterio_id && ln.sugestao_id);
  return (
    <>
      <Cabecalho eyebrow="Programar · medição" titulo="Critério de avanço"
        acoes={edita && <div className="flex flex-wrap gap-2">
          <label className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-m-stroke px-4 text-[13.5px] font-semibold text-m-accent hover:bg-m-accent-subtle ${importando ? 'pointer-events-none opacity-60' : ''}`}>
            <FileUp size={16} /> {importando ? 'Importando…' : 'Importar planilha de critérios'}
            <input type="file" accept=".xlsx,.xltx,.xlsm" className="sr-only" onChange={(e) => { importar(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <Botao onClick={() => abrir(null)}><Plus size={16} /> Critério</Botao>
        </div>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Critérios" valor={q.data?.criterios.length ?? '—'} />
        <Indicador rotulo="Etapas" valor={q.data ? q.data.criterios.reduce((s, c) => s + c.etapas.length, 0) : '—'} detalhe={`${q.data?.criterios.reduce((s, c) => s + c.etapas.filter((e) => e.sem_avanco).length, 0) ?? 0} sem avanço`} />
        <Indicador rotulo="Itens da PQ com critério" valor={q.data ? `${q.data.itens_cobertos} de ${q.data.itens_pq}` : '—'} detalhe="folhas da PQ vigente" />
        <Indicador rotulo="Não fecham 100%" valor={fora} tom={fora ? 'atencao' : 'sucesso'} />
      </div>
      <p className="text-[12.5px] text-m-text-muted">Na WBS, o botão <b>critério</b> do IWP cria as etapas abaixo dele. Cada etapa vira uma linha na programação: o valor é o PU do item × % da etapa; etapa <b>sem avanço</b> conta HH e capacidade, sem avanço físico nem faturamento.</p>
      {aberto === 'novo' && <Painel titulo="Novo critério">{editor}</Painel>}
      <Abas rotulo="Critérios" ativa={aba} onTrocar={(a) => { setAba(a); fechar(); }}
        abas={[{ chave: 'pq', titulo: 'Pela PQ' }, { chave: 'catalogo', titulo: 'Catálogo de critérios' }]} />
      {aba === 'pq' && (
        <Painel titulo="Itens da PQ e o critério de cada um"
          subtitulo="O critério casa pelo código CMS do item da PQ (ou pelo grupo do código); escolha à mão quando precisar"
          acoes={<div className="flex flex-wrap items-end gap-2">
            {FILTROS.map((x) => <Chip key={x.chave} ativo={filtro === x.chave} onClick={() => setFiltro(x.chave)}>{x.titulo}</Chip>)}
            <Campo rotulo="" aria-label="Buscar na PQ" placeholder="item, descrição, CMS" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-[220px]" />
            {edita && sugeridas.length > 0 && <Botao variante="secundario" title="Vincula cada item sem critério ao critério sugerido pela descrição" onClick={async () => {
              if (!(await confirmar({ titulo: `Usar as ${sugeridas.length} sugestões?`, mensagem: 'Cada item sem critério fica vinculado ao critério de descrição parecida. Dá para trocar depois na linha.', acao: 'Usar', perigo: false }))) return;
              for (const ln of sugeridas) await api.put(`/criterios/pq/${encodeURIComponent(ln.item)}/vinculo`, { criterio_id: ln.sugestao_id }).catch(() => undefined);
              toast.success(`${sugeridas.length} item(ns) vinculado(s)`); atualizar();
            }}>Aceitar {sugeridas.length} sugestões</Botao>}
          </div>}>
          <TabelaPq linhas={pq.data?.linhas ?? []} criterios={q.data?.criterios ?? []} filtro={filtro} busca={t} edita={edita}
            aberto={aberto} editor={editor} carregando={pq.isLoading}
            onAbrir={(ln, c) => (aberto === `pq:${ln.item}` ? fechar() : abrir(c, `pq:${ln.item}`, ln))} onVincular={vincular} />
        </Painel>
      )}
      {aba === 'catalogo' && <Painel titulo="Critérios da obra" acoes={<Campo rotulo="" aria-label="Buscar" placeholder="código, item, etapa" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-[260px]" />}>
        <Tabela cabecalho={['Critério', 'Item da PQ', 'Descrição', 'Etapas', 'Soma', 'Itens', 'Na WBS', '']} direita={[4, 5, 6]}
          vazio={!lista.length && (q.isLoading ? 'Carregando…' : 'Nenhum critério. Importe a planilha de critérios de medição.')}>
          {lista.map((c) => (
            <Fragment key={c.id}>
              <tr className="cursor-pointer align-top hover:bg-m-surface-hover" onClick={() => (edita ? abrir(c) : null)}>
                <td className={`${td} whitespace-nowrap font-semibold text-m-text-primary`}>{c.codigo}</td>
                <td className={td}>{c.item_pq ?? '—'}</td>
                <td className={`${td} max-w-[360px]`}><span className="line-clamp-2">{c.descricao}</span></td>
                <td className={td}><span className="flex flex-wrap gap-1">{c.etapas.map((e) => (
                  <span key={e.numero} title={e.documento ?? ''} className={`rounded-full px-2 py-0.5 text-[11.5px] ${e.sem_avanco ? 'bg-m-warning-subtle text-m-warning' : 'bg-m-surface-active text-m-text-secondary'}`}>{e.numero}. {e.nome} · {e.sem_avanco ? 'sem avanço' : pct(e.percentual)}</span>))}</span></td>
                <td className={`${td} whitespace-nowrap text-right`}><Calculado chave="soma" memoria={() => memSoma(c)} className={fecha(c) ? 'text-m-success' : 'text-m-warning'}>{pct(c.soma)}</Calculado></td>
                <td className={`${td} text-right`}>{c.itens_pq ?? 0}</td>
                <td className={`${td} text-right`}>{c.etapas_na_wbs || ''}</td>
                <td className={`${td} text-right`}>{edita && !c.etapas_na_wbs && <button type="button" aria-label={`Excluir ${c.codigo}`} className="p-1 text-m-text-muted hover:text-m-danger" onClick={async (ev) => {
                  ev.stopPropagation();
                  if (!(await confirmar({ titulo: `Excluir o critério ${c.codigo} (${c.item_pq ?? ''})?` }))) return;
                  try { await api.del(`/criterios/${c.id}`); atualizar(); } catch (e) { toast.error((e as Error).message); }
                }}><Trash2 size={14} /></button>}{c.origem === 'planilha' && <span className="ml-1"><Pilula ponto={false}>planilha</Pilula></span>}</td>
              </tr>
              {aberto === c.id && <tr><td colSpan={8} className="px-2 py-2">{editor}</td></tr>}
            </Fragment>
          ))}
        </Tabela>
      </Painel>}
    </>
  );
}

/** A PQ na ordem dela: títulos por nível e, em cada item, o critério que vale e como ele foi achado (spec 083). */
function TabelaPq({ linhas, criterios, filtro, busca, edita, aberto, editor, carregando, onAbrir, onVincular }: {
  linhas: LinhaPq[]; criterios: Criterio[]; filtro: Filtro; busca: string; edita: boolean; aberto: unknown; editor: React.ReactNode;
  carregando: boolean; onAbrir: (ln: LinhaPq, c: Criterio | null) => void; onVincular: (item: string, id: number | null) => void;
}) {
  const porId = useMemo(() => new Map(criterios.map((c) => [c.id, c])), [criterios]);
  const ordenados = useMemo(() => [...criterios].sort((a, b) => a.codigo.localeCompare(b.codigo)), [criterios]);
  const visiveis = useMemo(() => {
    const passa = (ln: LinhaPq) => {
      const c = ln.criterio_id ? porId.get(ln.criterio_id) : undefined;
      if (filtro === 'sem' && c) return false;
      if (filtro === 'com' && !c) return false;
      if (filtro === 'fora' && (!c || fecha(c))) return false;
      return !busca || [ln.item, ln.descricao, ln.cms, c?.codigo, c?.descricao].join(' ').toLowerCase().includes(busca);
    };
    const folhas = linhas.filter((ln) => ln.folha && passa(ln));
    if (filtro === 'todos' && !busca) return linhas;
    // com filtro: os itens que passam e os títulos acima deles
    const quer = new Set<string>();
    folhas.forEach((ln) => { const p = ln.item.split('.'); for (let i = 1; i <= p.length; i++) quer.add(p.slice(0, i).join('.')); });
    return linhas.filter((ln) => quer.has(ln.item));
  }, [linhas, porId, filtro, busca]);
  if (!linhas.length) return <p className="text-[13px] text-m-text-muted">{carregando ? <Esqueleto className="h-3.5 w-40 align-middle" /> : 'Sem PQ vigente: importe a PQ em Importações.'}</p>;
  return (
    <div className="max-h-[75vh] overflow-auto rounded-[10px] border border-m-stroke-subtle">
      <table className="w-full min-w-[1100px] border-collapse text-[12.5px]">
        <thead className="sticky top-0 z-10 bg-m-surface-raised">
          <tr className="text-left text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted">
            {['Item', 'Descrição das atividades', 'Unid.', 'Critério de medição', 'Descrição', 'Etapas', 'Soma', 'Itens', 'Na WBS'].map((h, i) => (
              <th key={h} className={`border-b border-m-stroke px-2 py-2 ${i >= 6 ? 'text-right' : ''}`}>{h}</th>))}
          </tr>
        </thead>
        <tbody>
          {visiveis.map((ln) => {
            if (!ln.folha) {
              return (
                <tr key={ln.item} className={`${FUNDO_NIVEL[Math.min(Math.max(ln.nivel - 1, 0), 4)]} font-semibold text-m-text-primary`}>
                  <td className="whitespace-nowrap border-b border-m-stroke-subtle px-2 py-1.5 font-mono text-[12px]">{ln.item}</td>
                  <td colSpan={8} className="border-b border-m-stroke-subtle px-2 py-1.5">{ln.descricao}</td>
                </tr>
              );
            }
            const c = ln.criterio_id ? porId.get(ln.criterio_id) ?? null : null;
            const chave = `pq:${ln.item}`;
            return (
              <Fragment key={ln.item}>
                <tr className={`align-top hover:bg-m-surface-hover ${edita ? 'cursor-pointer' : ''} ${aberto === chave ? 'bg-m-accent-subtle/30' : ''}`}
                  onClick={() => edita && onAbrir(ln, c)}>
                  <td className="whitespace-nowrap border-b border-m-stroke-subtle px-2 py-1.5 font-mono text-[12px]">{ln.item}</td>
                  <td className="max-w-[420px] border-b border-m-stroke-subtle px-2 py-1.5"><span className="line-clamp-2">{ln.descricao}</span></td>
                  <td className="whitespace-nowrap border-b border-m-stroke-subtle px-2 py-1.5">{ln.unid ?? ''}</td>
                  <td className="whitespace-nowrap border-b border-m-stroke-subtle px-2 py-1.5">
                    <span className="font-semibold text-m-text-primary">{ln.cms ?? '—'}</span>
                    {c && c.codigo !== ln.cms && <span className="block text-[11px] text-m-text-muted">→ {c.codigo}</span>}
                    {c && ln.como && <span className={`block text-[11px] ${ln.como === 'cms' ? 'text-m-text-muted' : 'text-m-accent'}`}>{ln.como_texto}{(ln.opcoes ?? 0) > 1 ? ` · ${ln.opcoes} com este código` : ''}</span>}
                  </td>
                  <td className="min-w-[260px] max-w-[340px] border-b border-m-stroke-subtle px-2 py-1.5">
                    {c ? <span className="line-clamp-2">{c.descricao}</span> : (
                      <span className="flex flex-col items-start gap-1" onClick={(e) => e.stopPropagation()}>
                        <Pilula tom="atencao">sem critério</Pilula>
                        {ln.sugestao_id && porId.get(ln.sugestao_id) && <span className="text-[11.5px] leading-4 text-m-text-secondary" title="Parecida pela descrição — confira antes de usar">
                          sugestão: <b className="whitespace-nowrap">{porId.get(ln.sugestao_id)!.codigo}</b> · {porId.get(ln.sugestao_id)!.descricao.slice(0, 60)}{' '}
                          {edita && <button type="button" className="font-semibold text-m-accent hover:underline" onClick={() => onVincular(ln.item, ln.sugestao_id!)}>usar</button>}</span>}
                        <span className="flex items-center gap-1.5">
                        {edita && <select aria-label={`Vincular critério ao item ${ln.item}`} value="" onChange={(e) => e.target.value && onVincular(ln.item, Number(e.target.value))}
                          className="h-7 max-w-[170px] rounded-[6px] border border-m-stroke bg-m-surface-field px-1 text-[11.5px]">
                          <option value="">vincular…</option>
                          {ordenados.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.descricao.slice(0, 50)}</option>)}
                        </select>}
                        {edita && <button type="button" className="text-[11.5px] font-semibold text-m-accent hover:underline" onClick={() => onAbrir(ln, null)}>criar</button>}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="border-b border-m-stroke-subtle px-2 py-1.5">{c && <span className="flex flex-wrap gap-1">{c.etapas.map((e) => (
                    <span key={e.numero} title={e.documento ?? ''} className={`rounded-full px-1.5 py-0.5 text-[11px] ${e.sem_avanco ? 'bg-m-warning-subtle text-m-warning' : 'bg-m-surface-active text-m-text-secondary'}`}>{e.numero}. {e.nome} · {e.sem_avanco ? 'sem avanço' : pct(e.percentual)}</span>))}</span>}</td>
                  <td className="whitespace-nowrap border-b border-m-stroke-subtle px-2 py-1.5 text-right">{c && <Calculado chave="soma" memoria={() => memSoma(c)} className={fecha(c) ? 'text-m-success' : 'text-m-warning'}>{pct(c.soma)}</Calculado>}</td>
                  <td className="border-b border-m-stroke-subtle px-2 py-1.5 text-right" title="itens da PQ que usam este critério">{c ? c.itens_pq ?? 0 : ''}</td>
                  <td className="border-b border-m-stroke-subtle px-2 py-1.5 text-right" title="etapas deste critério já criadas na WBS">{c?.etapas_na_wbs || ''}</td>
                </tr>
                {aberto === chave && (
                  <tr><td colSpan={9} className="border-b border-m-stroke-subtle px-2 py-2">
                    {c && (ln.vinculado || (ln.opcoes ?? 0) > 1 || ln.como === 'cms_grupo') && edita && (
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-[12.5px]">
                        <span className="text-m-text-secondary">Critério deste item:</span>
                        <select aria-label="Trocar o critério do item" value={c.id} onChange={(e) => onVincular(ln.item, Number(e.target.value))}
                          className="h-8 max-w-[420px] rounded-[8px] border border-m-stroke bg-m-surface-field px-2">
                          {ordenados.map((x) => <option key={x.id} value={x.id}>{x.codigo} · item {x.item_pq ?? '—'} · {x.descricao.slice(0, 60)}</option>)}
                        </select>
                        {ln.vinculado && <button type="button" className="font-semibold text-m-accent hover:underline" onClick={() => onVincular(ln.item, null)}>voltar ao automático</button>}
                      </div>
                    )}
                    {c && c.itens_pq && c.itens_pq > 1 && <p className="mb-2 text-[12px] text-m-warning">Este critério vale para {c.itens_pq} itens da PQ: a mudança vale para todos.</p>}
                    {editor}
                  </td></tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
