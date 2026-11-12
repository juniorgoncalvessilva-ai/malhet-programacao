'use client';

import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, ListOrdered, Save } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calculado } from '@/components/Obra/Calculado';
import { Botao } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import type { LinhaVisao, TipoLigacao } from '@/lib/api/types';
import { nomeLinha, type ModoNomes } from '@/lib/programacao/nomes';

/** Agrupar a programação por frente (Local → Área) ou por encarregado (Encarregado → linhas na sequência). */
export function AgruparPor({ porEnc, onChange }: { porEnc: boolean; onChange: (v: boolean) => void }) {
  return (
    <div role="group" aria-label="Agrupar a programação" className="inline-flex items-center gap-1 rounded-full border border-m-stroke bg-m-surface-raised p-0.5 print:hidden">
      {([[false, 'Por frente'], [true, 'Por encarregado']] as const).map(([v, r]) => (
        <button key={r} type="button" aria-pressed={porEnc === v} onClick={() => onChange(v)}
          className={`h-8 rounded-full px-3 text-[12.5px] font-semibold ${porEnc === v ? 'bg-m-accent text-white' : 'text-m-text-secondary hover:bg-m-surface-hover'}`}>{r}</button>
      ))}
    </div>
  );
}

type Lig = { de: number; tipo: TipoLigacao; lag: number };
type Visao = { dias: { data: string; dia: string }[]; locais: { codigo: string; descricao: string; areas: { codigo: string; descricao: string; linhas: LinhaVisao[] }[] }[] };
const dia = (iso: string) => new Date(`${iso}T12:00:00`).getTime();
const DIA_MS = 86_400_000;
const LINHA_H = 34; // altura de cada tarefa (tabela e Gantt alinhados, como no Project)
const DIA_W_MIN = 30;
const DO_INGLES: Record<string, TipoLigacao> = { FS: 'TI', SS: 'II', FF: 'TT', SF: 'IT', TI: 'TI', II: 'II', TT: 'TT', IT: 'IT' };
const ROTULO: Record<TipoLigacao, string> = { TI: 'término-início', II: 'início-início', TT: 'término-término', IT: 'início-término' };

/** Mesma regra do backend (planejamento/domain/sequencia.py), para conferir na hora, antes de salvar. */
function conferir(l: Lig, pred?: [string, string] | null, suc?: [string, string] | null): string | null {
  if (!pred || !suc) return null;
  const [pi, pf, si, sf] = [dia(pred[0]), dia(pred[1]), dia(suc[0]), dia(suc[1])];
  const d = l.lag * DIA_MS;
  if (l.tipo === 'TI' && si <= pf + d) return 'começa antes do término da predecessora';
  if (l.tipo === 'II' && si < pi + d) return 'começa antes do início da predecessora';
  if (l.tipo === 'TT' && sf < pf + d) return 'termina antes do término da predecessora';
  if (l.tipo === 'IT' && sf < pi + d) return 'termina antes do início da predecessora';
  return null;
}

/**
 * Aba Sequência no modelo do MS Project (spec 054): tabela (Id, Nome da tarefa, Duração, Início, Término,
 * Predecessoras, Encarregado) à esquerda e Gantt com as setas das ligações à direita. Predecessoras como no Project:
 * "3" (término-início), "3TI+2 dias", "2II", "4TT", "5IT" (aceita também FS/SS/FF/SF), separadas por ";".
 */
export function SequenciaProgramacao({ pid, v, nomes, editar }: { pid: number; v: Visao; nomes: ModoNomes; editar: boolean }) {
  const api = useApi();
  const linhas = useMemo(() => v.locais.flatMap((l) => l.areas.flatMap((a) => a.linhas.map((ln) => ({ ...ln, onde: `${l.codigo} · ${a.codigo} ${a.descricao}` }))))
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)), [v]);
  const porId = useMemo(() => new Map(linhas.map((l) => [l.id, l])), [linhas]);
  const [ordem, setOrdem] = useState<number[]>([]);
  const [ligs, setLigs] = useState<Record<number, Lig[]>>({});
  const [rasc, setRasc] = useState<Record<number, string>>({});
  const [sujo, setSujo] = useState(false);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [classificar, setClassificar] = useState<'id' | 'inicio' | 'termino' | 'duracao' | 'encarregado' | 'frente'>('id');
  const [agrupar, setAgrupar] = useState<'nenhum' | 'frente' | 'encarregado'>('nenhum');
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (sujo) return; // não atropela o que está sendo editado quando os dados recarregam
    setOrdem(linhas.map((l) => l.id));
    setLigs(Object.fromEntries(linhas.map((l) => [l.id, (l.predecessoras ?? []) as Lig[]])));
  }, [linhas]); // eslint-disable-line react-hooks/exhaustive-deps
  const pos = useMemo(() => new Map(ordem.map((lid, i) => [lid, i + 1])), [ordem]);

  const texto = (lid: number) => (ligs[lid] ?? []).map((x) => {
    const n = pos.get(x.de) ?? '?';
    const lag = x.lag ? `${x.lag > 0 ? '+' : ''}${x.lag} ${Math.abs(x.lag) === 1 ? 'dia' : 'dias'}` : '';
    return x.tipo === 'TI' && !x.lag ? `${n}` : `${n}${x.tipo}${lag}`;
  }).join(';');
  const aplicarTexto = (lid: number, s: string) => {
    const novos: Lig[] = [];
    for (const parte of s.split(/[;,]+/).map((p) => p.trim()).filter(Boolean)) {
      const m = /^(\d+)\s*(TI|II|TT|IT|FS|SS|FF|SF)?\s*(?:([+-])\s*(\d+)\s*(?:d|dia|dias)?)?$/i.exec(parte);
      const de = m ? ordem[Number(m[1]) - 1] : undefined;
      if (!m || de === undefined) { toast.error(`"${parte}" não é uma predecessora válida (ex.: 3 · 3TI+2 dias · 2II · 4TT)`); return; }
      if (de === lid) { toast.error('a tarefa não pode depender dela mesma'); return; }
      novos.push({ de, tipo: DO_INGLES[(m[2] ?? 'TI').toUpperCase()], lag: m[3] ? Number(`${m[3]}${m[4]}`) : 0 });
    }
    setLigs((g) => ({ ...g, [lid]: novos }));
    setSujo(true);
  };
  const mover = (de: number, para: number) => {
    if (de === para) return;
    setOrdem((o) => { const n = [...o]; const [x] = n.splice(de, 1); n.splice(para, 0, x); return n; });
    setSujo(true);
  };
  const cronologica = () => {
    const feitos = new Set<number>();
    const saida: number[] = [];
    const ini = (lid: number) => (porId.get(lid)?.janela ? dia(porId.get(lid)!.janela![0]) : Number.MAX_SAFE_INTEGER);
    while (saida.length < ordem.length) {
      const livres = ordem.filter((lid) => !feitos.has(lid) && (ligs[lid] ?? []).every((x) => feitos.has(x.de) || !pos.has(x.de)));
      const cands = livres.length ? livres : ordem.filter((lid) => !feitos.has(lid));
      const n = cands.reduce((a, b) => (ini(b) < ini(a) || (ini(b) === ini(a) && pos.get(b)! < pos.get(a)!) ? b : a));
      saida.push(n); feitos.add(n);
    }
    setOrdem(saida); setSujo(true);
    toast.success('Ordenado pelo início, respeitando as predecessoras');
  };
  const salvar = async () => {
    setSalvando(true);
    try {
      await api.put(`/programacoes/${pid}/sequencia`, { ordem, predecessoras: Object.fromEntries(Object.entries(ligs).filter(([, ls]) => ls.length)) });
      toast.success('Sequência salva');
      setSujo(false);
    } catch (e) { toast.error((e as Error).message); } finally { setSalvando(false); }
  };
  const alertas = (lid: number) => (ligs[lid] ?? []).map((x) => {
    const m = conferir(x, porId.get(x.de)?.janela, porId.get(lid)?.janela);
    return m ? `${pos.get(x.de)}${x.tipo} (${ROTULO[x.tipo]}): ${m}` : null;
  }).filter(Boolean) as string[];
  const nAlertas = ordem.reduce((s, lid) => s + alertas(lid).length, 0);

  // Gantt: coluna de cada dia; barra do 1º ao último dia com previsto, dias com previsto mais fortes
  const DIA_W = v.dias.length <= 10 ? 46 : v.dias.length <= 16 ? 36 : DIA_W_MIN; // semana: colunas largas; mês: estreitas
  const idxDia = useMemo(() => new Map(v.dias.map((d, i) => [d.data, i])), [v.dias]);
  const barra = (lid: number) => {
    const j = porId.get(lid)?.janela;
    if (!j) return null;
    const a = idxDia.get(j[0]); const b = idxDia.get(j[1]);
    return a === undefined || b === undefined ? null : { a, b };
  };
  const larguraGantt = v.dias.length * DIA_W;
  const ordenavel = classificar === 'id' && agrupar === 'nenhum'; // arrastar só na ordem do Id, sem grupos
  const nDias = (lid: number) => v.dias.filter((_, di) => porId.get(lid)?.previsto[di]).length;
  const frenteDe = (lid: number) => porId.get(lid)?.onde ?? '—';
  const encDe = (lid: number) => porId.get(lid)?.encarregado ?? porId.get(lid)?.equipe ?? 'Sem encarregado';
  const chaveOrd = (lid: number): (string | number)[] => {
    const j = porId.get(lid)?.janela;
    const ini = j ? dia(j[0]) : Number.MAX_SAFE_INTEGER; const fim = j ? dia(j[1]) : Number.MAX_SAFE_INTEGER;
    switch (classificar) {
      case 'inicio': return [ini, fim, pos.get(lid) ?? 0];
      case 'termino': return [fim, ini, pos.get(lid) ?? 0];
      case 'duracao': return [-nDias(lid), ini, pos.get(lid) ?? 0];
      case 'encarregado': return [encDe(lid), ini, pos.get(lid) ?? 0];
      case 'frente': return [frenteDe(lid), pos.get(lid) ?? 0];
      default: return [pos.get(lid) ?? 0];
    }
  };
  const cmp = (a: number, b: number) => {
    const x = chaveOrd(a); const y = chaveOrd(b);
    for (let k = 0; k < x.length; k++) { if (x[k] < y[k]) return -1; if (x[k] > y[k]) return 1; }
    return 0;
  };
  type Vis = { tipo: 'grupo'; chave: string; rotulo: string; ids: number[] } | { tipo: 'tarefa'; lid: number };
  const vis: Vis[] = (() => {
    const ordenadas = [...ordem].sort(cmp);
    if (agrupar === 'nenhum') return ordenadas.map((lid) => ({ tipo: 'tarefa' as const, lid }));
    const chaveG = agrupar === 'frente' ? frenteDe : encDe;
    const grupos = new Map<string, number[]>();
    for (const lid of ordenadas) { const k = chaveG(lid); grupos.set(k, [...(grupos.get(k) ?? []), lid]); }
    return [...grupos.entries()].sort(([a, ia], [b, ib]) => (agrupar === 'frente' ? a.localeCompare(b, 'pt-BR', { numeric: true }) : cmp(ia[0], ib[0])))
      .flatMap(([k, ids]) => [{ tipo: 'grupo' as const, chave: k, rotulo: k, ids }, ...(fechados.has(k) ? [] : ids.map((lid) => ({ tipo: 'tarefa' as const, lid })))]);
  })();
  const linhaDe = new Map(vis.flatMap((x, r) => (x.tipo === 'tarefa' ? [[x.lid, r] as [number, number]] : [])));
  const barraGrupo = (ids: number[]) => {
    const bs = ids.map(barra).filter(Boolean) as { a: number; b: number }[];
    return bs.length ? { a: Math.min(...bs.map((x) => x.a)), b: Math.max(...bs.map((x) => x.b)) } : null;
  };
  const setas = ordem.flatMap((lid) => (ligs[lid] ?? []).map((x) => {
    const rP = linhaDe.get(x.de); const rS = linhaDe.get(lid);
    const bp = barra(x.de); const bs = barra(lid);
    if (rP === undefined || rS === undefined || !bp || !bs) return null;
    const yP = rP * LINHA_H + LINHA_H / 2; const yS = rS * LINHA_H + LINHA_H / 2;
    const xP = (x.tipo === 'TI' || x.tipo === 'TT' ? bp.b + 1 : bp.a) * DIA_W + (x.tipo === 'TI' || x.tipo === 'TT' ? 0 : 0);
    const fimNoInicio = x.tipo === 'TI' || x.tipo === 'II';
    const xS = (fimNoInicio ? bs.a : bs.b + 1) * DIA_W;
    const meio = fimNoInicio ? Math.min(xP + 8, xS - 6) : Math.max(xP + 8, xS + 8);
    const ruim = !!conferir(x, porId.get(x.de)?.janela, porId.get(lid)?.janela);
    const d = fimNoInicio
      ? `M${xP},${yP} H${meio} V${yS} H${xS - 1}`
      : `M${xP},${yP} H${meio} V${yS} H${xS + 1}`;
    return { k: `${x.de}-${lid}-${x.tipo}`, d, ruim, fimNoInicio, xS, yS };
  })).filter(Boolean) as { k: string; d: string; ruim: boolean; fimNoInicio: boolean; xS: number; yS: number }[];

  if (!linhas.length) return <p className="rounded-m-lg border border-dashed border-m-stroke p-8 text-center text-sm text-m-text-secondary">Nenhuma linha programada ainda.</p>;
  const th = 'h-[46px] border-b border-r border-m-stroke-subtle bg-m-surface-hover px-2 text-left text-[11px] font-semibold uppercase tracking-[0.3px] text-m-text-muted';
  const td = 'border-b border-r border-m-stroke-subtle px-2 text-[12.5px]';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {editar && <Botao variante="secundario" onClick={cronologica}><ListOrdered size={16} /> Ordenar cronologicamente</Botao>}
        {editar && <Botao disabled={!sujo || salvando} onClick={salvar}><Save size={16} /> {salvando ? 'Salvando…' : 'Salvar sequência'}</Botao>}
        {sujo && <span className="text-[12.5px] font-semibold text-m-warning">alterações não salvas</span>}
        <label className="flex items-center gap-1.5 text-[12.5px] text-m-text-secondary">Classificar por
          <select aria-label="Classificar por" value={classificar} onChange={(e) => setClassificar(e.target.value as typeof classificar)} className="h-9 rounded-full border border-m-stroke bg-m-surface-field px-3 text-[12.5px] text-m-text-primary">
            <option value="id">Id (sequência)</option><option value="inicio">Início</option><option value="termino">Término</option>
            <option value="duracao">Duração (maior primeiro)</option><option value="encarregado">Encarregado</option><option value="frente">Frente</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-m-text-secondary">Agrupar por
          <select aria-label="Agrupar por" value={agrupar} onChange={(e) => { setAgrupar(e.target.value as typeof agrupar); setFechados(new Set()); }} className="h-9 rounded-full border border-m-stroke bg-m-surface-field px-3 text-[12.5px] text-m-text-primary">
            <option value="nenhum">Nenhum</option><option value="frente">Frente</option><option value="encarregado">Encarregado</option>
          </select>
        </label>
        <span className={`text-[12.5px] ${nAlertas ? 'text-m-danger' : 'text-m-text-muted'}`}>{nAlertas ? `${nAlertas} predecessora(s) não respeitada(s) pelos dias programados` : 'Predecessoras conferidas com os dias programados'}</span>
      </div>
      <p className="text-[12px] text-m-text-muted">Como no MS Project: arraste as tarefas para ordenar (com Classificar por Id e sem agrupamento); em Predecessoras digite o Id e o tipo — <b>3</b> (término-início) · <b>3TI+2 dias</b> · <b>2II</b> · <b>4TT</b> · <b>5IT</b> — separados por &quot;;&quot;. Início e término = 1º e último dia com previsto.</p>

      <div className="flex overflow-hidden rounded-m-lg border border-m-stroke-subtle bg-m-surface-raised">
        {/* tabela (lado esquerdo do Project) */}
        <div className="min-w-0 shrink-0 overflow-x-auto" style={{ maxWidth: '62%' }}>
          <table className="border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-[64px]`}>Id</th><th className={`${th} min-w-[280px]`}>Nome da tarefa</th>
                <th className={`${th} w-[72px] text-right`}>Duração</th><th className={`${th} w-[86px]`}>Início</th><th className={`${th} w-[86px]`}>Término</th>
                <th className={`${th} w-[130px]`}>Predecessoras</th><th className={`${th} min-w-[150px]`}>Encarregado</th>
              </tr>
            </thead>
            <tbody>
              {vis.map((x, r) => {
                if (x.tipo === 'grupo') {
                  const bg = barraGrupo(x.ids);
                  const fechado = fechados.has(x.chave);
                  return (
                    <tr key={`g:${x.chave}`} style={{ height: LINHA_H }} className="bg-m-surface-hover font-semibold">
                      <td className={`${td} text-center`}><button type="button" aria-label={`${fechado ? 'Abrir' : 'Recolher'} ${x.rotulo}`} onClick={() => setFechados((s) => { const n = new Set(s); if (n.has(x.chave)) n.delete(x.chave); else n.add(x.chave); return n; })} className="text-m-text-secondary">{fechado ? '▸' : '▾'}</button></td>
                      <td className={`${td} max-w-[360px] truncate text-m-text-primary`} title={x.rotulo}>{x.rotulo} <span className="font-normal text-m-text-muted">· {x.ids.length} tarefa(s)</span></td>
                      <td className={`${td} text-right`}>{bg ? `${bg.b - bg.a + 1} d` : '—'}</td>
                      <td className={td}>{bg ? v.dias[bg.a].data.slice(8) + '/' + v.dias[bg.a].data.slice(5, 7) : '—'}</td>
                      <td className={td}>{bg ? v.dias[bg.b].data.slice(8) + '/' + v.dias[bg.b].data.slice(5, 7) : '—'}</td>
                      <td className={td} /><td className={td} />
                    </tr>
                  );
                }
                const lid = x.lid;
                const i = ordem.indexOf(lid);
                const ln = porId.get(lid);
                if (!ln) return null;
                const al = alertas(lid);
                const diasPrev = v.dias.filter((_, di) => ln.previsto[di]).map((d) => d.data);
                return (
                  <tr key={lid} style={{ height: LINHA_H, ...(r % 2 === 1 && !al.length ? { background: 'color-mix(in srgb, #44546A 10%, transparent)' } : {}) }} className={`${arrastando === i ? 'opacity-40' : ''} ${al.length ? 'bg-m-danger-subtle' : ''}`}
                    draggable={editar && ordenavel} onDragStart={(e) => { setArrastando(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
                    onDragEnd={() => setArrastando(null)} onDragOver={(e) => { if (editar) e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); const de = Number(e.dataTransfer.getData('text/plain')); if (!Number.isNaN(de)) mover(de, i); setArrastando(null); }}>
                    <td className={`${td} whitespace-nowrap`}>
                      <span className="inline-flex items-center gap-0.5">
                        {editar && ordenavel && <GripVertical size={13} className="cursor-grab text-m-text-muted" aria-hidden="true" />}
                        <b className="w-5 text-right text-m-text-primary">{i + 1}</b>
                        {editar && ordenavel && <>
                          <button type="button" aria-label={`Subir ${ln.codigo_simova}`} disabled={i === 0} className="text-m-text-muted disabled:opacity-30" onClick={() => mover(i, i - 1)}><ArrowUp size={12} /></button>
                          <button type="button" aria-label={`Descer ${ln.codigo_simova}`} disabled={i === ordem.length - 1} className="text-m-text-muted disabled:opacity-30" onClick={() => mover(i, i + 1)}><ArrowDown size={12} /></button>
                        </>}
                      </span>
                    </td>
                    <td className={`${td} max-w-[360px] ${agrupar !== 'nenhum' ? 'pl-5' : ''}`} title={`${ln.onde}${ln.cwp?.texto ? ` · CWP ${ln.cwp.texto}` : ''}${al.length ? `\n${al.join('\n')}` : ''}`}>
                      <span className="block truncate">{al.length > 0 && <AlertTriangle size={12} className="mr-1 inline text-m-danger" />}<b className="text-m-text-primary">{ln.codigo_simova}</b> {nomeLinha(ln, nomes)}</span>
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>{diasPrev.length
                      ? <Calculado chave={`dur:${lid}`} memoria={() => ({ chave: `dur:${lid}`, titulo: `Duração de ${ln.codigo_simova}`, valor: `${diasPrev.length} dias`, formula: 'dias do período com previsto na linha',
                          passos: diasPrev.map((d) => ({ descricao: d.split('-').reverse().join('/'), conta: 'previsto > 0', resultado: '1 dia', destaque: false })), fontes: [{ dado: 'Previsto por dia', valor: `${diasPrev.length} dia(s)`, origem: 'Programação', local: `linha ${ln.codigo_simova}` }], notas: [] })}>{`${diasPrev.length} ${diasPrev.length === 1 ? 'dia' : 'dias'}`}</Calculado>
                      : '—'}</td>
                    <td className={`${td} whitespace-nowrap`}>{ln.janela ? ln.janela[0].slice(8) + '/' + ln.janela[0].slice(5, 7) : '—'}</td>
                    <td className={`${td} whitespace-nowrap`}>{ln.janela ? ln.janela[1].slice(8) + '/' + ln.janela[1].slice(5, 7) : '—'}</td>
                    <td className={`${td} p-0`}>
                      <input aria-label={`Predecessoras de ${ln.codigo_simova}`} disabled={!editar} placeholder="" value={rasc[lid] ?? texto(lid)}
                        onChange={(e) => setRasc({ ...rasc, [lid]: e.target.value })}
                        onBlur={() => { if (rasc[lid] !== undefined) { aplicarTexto(lid, rasc[lid]); const n = { ...rasc }; delete n[lid]; setRasc(n); } }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className={`h-[33px] w-full bg-transparent px-2 text-[12.5px] outline-none focus:bg-m-surface-field focus:ring-1 focus:ring-m-accent ${al.length ? 'text-m-danger' : 'text-m-text-primary'}`} />
                    </td>
                    <td className={`${td} max-w-[180px] truncate`}>{ln.encarregado ?? ln.equipe ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Gantt (lado direito do Project) */}
        <div className="min-w-0 flex-1 overflow-x-auto border-l-2 border-m-stroke">
          <div style={{ width: larguraGantt }}>
            <div className="flex h-[46px] border-b border-m-stroke-subtle bg-m-surface-hover">
              {v.dias.map((d) => (
                <div key={d.data} style={{ width: DIA_W }} className={`flex shrink-0 flex-col items-center justify-center border-r border-m-stroke-subtle text-[10px] leading-3 text-m-text-muted ${['SÁB', 'DOM'].includes(d.dia) ? 'bg-m-surface-active' : ''}`}>
                  <span>{d.dia.slice(0, 1)}</span><span className="font-semibold text-m-text-secondary">{d.data.slice(8)}</span>
                </div>
              ))}
            </div>
            <div className="relative" style={{ height: vis.length * LINHA_H }}>
              {/* fundo: fins de semana e linhas */}
              <div className="absolute inset-0 flex">
                {v.dias.map((d) => <div key={d.data} style={{ width: DIA_W }} className={`h-full shrink-0 border-r border-m-stroke-subtle ${['SÁB', 'DOM'].includes(d.dia) ? 'bg-m-surface-hover' : ''}`} />)}
              </div>
              {vis.map((x, i) => {
                if (x.tipo === 'grupo') {
                  const bg = barraGrupo(x.ids);
                  return (
                    <Fragment key={`g:${x.chave}`}>
                      <div className="absolute left-0 right-0 bg-m-surface-hover" style={{ top: i * LINHA_H, height: LINHA_H - 1 }} />
                      <div className="absolute left-0 right-0 border-b border-m-stroke-subtle" style={{ top: (i + 1) * LINHA_H - 1 }} />
                      {bg && <div className="absolute bg-m-text-primary" title={`${x.rotulo}: resumo`} style={{ top: i * LINHA_H + 13, height: 6, left: bg.a * DIA_W + 2, width: (bg.b - bg.a + 1) * DIA_W - 4, clipPath: 'polygon(0 0,100% 0,100% 100%,calc(100% - 5px) 50%,5px 50%,0 100%)' }} />}
                    </Fragment>
                  );
                }
                const lid = x.lid;
                const ln = porId.get(lid);
                const b = barra(lid);
                const ruim = alertas(lid).length > 0;
                return (
                  <Fragment key={lid}>
                    <div className="absolute left-0 right-0 border-b border-m-stroke-subtle" style={{ top: (i + 1) * LINHA_H - 1 }} />
                    {ln && b && (
                      <>
                        <div className="absolute rounded-[3px]" style={{ background: `color-mix(in srgb, var(${ruim ? '--m-danger' : '--m-accent'}) 22%, transparent)`, top: i * LINHA_H + 9, height: LINHA_H - 18, left: b.a * DIA_W + 2, width: (b.b - b.a + 1) * DIA_W - 4 }} title={`${ln.codigo_simova}: ${ln.janela?.[0]} a ${ln.janela?.[1]}`} />
                        {v.dias.map((d, di) => (ln.previsto[di] ? <div key={d.data} className={`absolute rounded-[2px] ${ruim ? 'bg-m-danger' : 'bg-m-accent'}`} style={{ top: i * LINHA_H + 11, height: LINHA_H - 22, left: di * DIA_W + 3, width: DIA_W - 6 }} title={`${d.data.split('-').reverse().join('/')}: ${ln.previsto[di]} ${ln.unidade ?? ''}`} /> : null))}
                      </>
                    )}
                  </Fragment>
                );
              })}
              <svg className="pointer-events-none absolute left-0 top-0" width={larguraGantt} height={vis.length * LINHA_H} aria-hidden="true">
                <defs>
                  <marker id="seta-ok" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--m-text-secondary)" /></marker>
                  <marker id="seta-ruim" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--m-danger)" /></marker>
                </defs>
                {setas.map((s) => <path key={s.k} d={s.d} fill="none" strokeWidth={1.3} stroke={s.ruim ? 'var(--m-danger)' : 'var(--m-text-secondary)'} markerEnd={`url(#${s.ruim ? 'seta-ruim' : 'seta-ok'})`} />)}
              </svg>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[12px] text-m-text-muted">A sequência salva vira a ordem das tarefas na programação e no agrupamento por encarregado. Tarefa em vermelho: os dias programados não respeitam a predecessora (passe o mouse no nome para ver o motivo).</p>
    </div>
  );
}
