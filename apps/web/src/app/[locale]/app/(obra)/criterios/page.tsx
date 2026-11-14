'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Plus, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Botao, Cabecalho, Campo, Indicador, Painel, Pilula, Tabela, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

interface Etapa { id?: number; numero: number; nome: string; documento: string | null; percentual: number; sem_avanco: boolean }
interface Criterio { id: number; codigo: string; item_pq: string | null; descricao: string; origem: string; etapas: Etapa[]; soma: number; itens_pq: number | null; etapas_na_wbs: number }
interface Lista { criterios: Criterio[]; itens_pq: number; itens_cobertos: number }

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
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<number | 'novo' | null>(null);
  const [f, setF] = useState<{ codigo: string; item_pq: string; descricao: string; etapas: Etapa[] } | null>(null);
  const [importando, setImportando] = useState(false);
  const atualizar = () => qc.invalidateQueries({ queryKey: ['criterios'] });
  const t = busca.trim().toLowerCase();
  const lista = (q.data?.criterios ?? []).filter((c) => !t || [c.codigo, c.item_pq, c.descricao, ...c.etapas.map((e) => e.nome)].join(' ').toLowerCase().includes(t));

  const abrir = (c: Criterio | null) => {
    setAberto(c ? c.id : 'novo');
    setF(c ? { codigo: c.codigo, item_pq: c.item_pq ?? '', descricao: c.descricao, etapas: c.etapas.map((e) => ({ ...e })) }
      : { codigo: '', item_pq: '', descricao: '', etapas: [{ numero: 1, nome: '', documento: null, percentual: 1, sem_avanco: false }] });
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
      if (aberto === 'novo') await api.post('/criterios', corpo); else await api.put(`/criterios/${aberto}`, corpo);
      toast.success('Critério salvo'); setAberto(null); setF(null); atualizar();
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
        <Botao variante="secundario" onClick={() => { setAberto(null); setF(null); }}>Cancelar</Botao>
      </div>
    </div>
  );

  const fora = (q.data?.criterios ?? []).filter((c) => !fecha(c)).length;
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
      <Painel titulo="Critérios da obra" acoes={<Campo rotulo="" aria-label="Buscar" placeholder="código, item, etapa" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-[260px]" />}>
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
      </Painel>
    </>
  );
}
