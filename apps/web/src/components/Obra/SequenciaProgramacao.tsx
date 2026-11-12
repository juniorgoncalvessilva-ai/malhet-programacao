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
  const setas = ordem.flatMap((lid, i) => (ligs[lid] ?? []).map((x) => {
    const j = pos.get(x.de);
    const bp = barra(x.de); const bs = barra(lid);
    if (!j || !bp || !bs) return null;
    const yP = (j - 1) * LINHA_H + LINHA_H / 2; const yS = i * LINHA_H + LINHA_H / 2;
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
        <span className={`text-[12.5px] ${nAlertas ? 'text-m-danger' : 'text-m-text-muted'}`}>{nAlertas ? `${nAlertas} predecessora(s) não respeitada(s) pelos dias programados` : 'Predecessoras conferidas com os dias programados'}</span>
      </div>
      <p className="text-[12px] text-m-text-muted">Como no MS Project: arraste as tarefas para ordenar; em Predecessoras digite o Id e o tipo — <b>3</b> (término-início) · <b>3TI+2 dias</b> · <b>2II</b> · <b>4TT</b> · <b>5IT</b> — separados por &quot;;&quot;. Início e término = 1º e último dia com previsto.</p>

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
              {ordem.map((lid, i) => {
                const ln = porId.get(lid);
                if (!ln) return null;
                const al = alertas(lid);
                const diasPrev = v.dias.filter((_, di) => ln.previsto[di]).map((d) => d.data);
                return (
                  <tr key={lid} style={{ height: LINHA_H }} className={`${arrastando === i ? 'opacity-40' : ''} ${al.length ? 'bg-m-danger-subtle' : ''}`}
                    draggable={editar} onDragStart={(e) => { setArrastando(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
                    onDragEnd={() => setArrastando(null)} onDragOver={(e) => { if (editar) e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); const de = Number(e.dataTransfer.getData('text/plain')); if (!Number.isNaN(de)) mover(de, i); setArrastando(null); }}>
                    <td className={`${td} whitespace-nowrap`}>
                      <span className="inline-flex items-center gap-0.5">
                        {editar && <GripVertical size={13} className="cursor-grab text-m-text-muted" aria-hidden="true" />}
                        <b className="w-5 text-right text-m-text-primary">{i + 1}</b>
                        {editar && <>
                          <button type="button" aria-label={`Subir ${ln.codigo_simova}`} disabled={i === 0} className="text-m-text-muted disabled:opacity-30" onClick={() => mover(i, i - 1)}><ArrowUp size={12} /></button>
                          <button type="button" aria-label={`Descer ${ln.codigo_simova}`} disabled={i === ordem.length - 1} className="text-m-text-muted disabled:opacity-30" onClick={() => mover(i, i + 1)}><ArrowDown size={12} /></button>
                        </>}
                      </span>
                    </td>
                    <td className={`${td} max-w-[360px]`} title={`${ln.onde}${ln.cwp?.texto ? ` · CWP ${ln.cwp.texto}` : ''}${al.length ? `\n${al.join('\n')}` : ''}`}>
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
            <div className="relative" style={{ height: ordem.length * LINHA_H }}>
              {/* fundo: fins de semana e linhas */}
              <div className="absolute inset-0 flex">
                {v.dias.map((d) => <div key={d.data} style={{ width: DIA_W }} className={`h-full shrink-0 border-r border-m-stroke-subtle ${['SÁB', 'DOM'].includes(d.dia) ? 'bg-m-surface-hover' : ''}`} />)}
              </div>
              {ordem.map((lid, i) => {
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
              <svg className="pointer-events-none absolute left-0 top-0" width={larguraGantt} height={ordem.length * LINHA_H} aria-hidden="true">
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
