'use client';

import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, GripVertical, ListOrdered, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Botao, dataBR } from '@/components/Obra/ui';
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

const TIPOS: { t: TipoLigacao; rotulo: string; dica: string }[] = [
  { t: 'TI', rotulo: 'TI', dica: 'Término → Início: começa depois que a predecessora termina' },
  { t: 'II', rotulo: 'II', dica: 'Início → Início: começa junto ou depois do início da predecessora' },
  { t: 'TT', rotulo: 'TT', dica: 'Término → Término: termina junto ou depois do término da predecessora' },
  { t: 'IT', rotulo: 'IT', dica: 'Início → Término: termina junto ou depois do início da predecessora' },
];
type Lig = { de: number; tipo: TipoLigacao; lag: number };
type Visao = { locais: { codigo: string; descricao: string; areas: { codigo: string; descricao: string; linhas: LinhaVisao[] }[] }[] };
const dia = (iso: string) => new Date(`${iso}T12:00:00`).getTime();
const DIA_MS = 86_400_000;

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

/** Aba Sequência (spec 054): ordem cronológica por arrastar e soltar e ligações TI/II/TT/IT entre as linhas. */
export function SequenciaProgramacao({ pid, v, nomes, editar }: { pid: number; v: Visao; nomes: ModoNomes; editar: boolean }) {
  const api = useApi();
  const linhas = useMemo(() => v.locais.flatMap((l) => l.areas.flatMap((a) => a.linhas.map((ln) => ({ ...ln, onde: `${l.codigo} · ${a.codigo}` }))))
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)), [v]);
  const porId = useMemo(() => new Map(linhas.map((l) => [l.id, l])), [linhas]);
  const [ordem, setOrdem] = useState<number[]>([]);
  const [ligs, setLigs] = useState<Record<number, Lig[]>>({});
  const [rasc, setRasc] = useState<Record<string, string>>({});
  const [sujo, setSujo] = useState(false);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (sujo) return; // não atropela o que está sendo editado quando os dados recarregam
    setOrdem(linhas.map((l) => l.id));
    setLigs(Object.fromEntries(linhas.map((l) => [l.id, (l.predecessoras ?? []) as Lig[]])));
  }, [linhas]); // eslint-disable-line react-hooks/exhaustive-deps
  const pos = useMemo(() => new Map(ordem.map((lid, i) => [lid, i + 1])), [ordem]);

  const texto = (lid: number, t: TipoLigacao) => (ligs[lid] ?? []).filter((x) => x.tipo === t)
    .map((x) => `${pos.get(x.de) ?? '?'}${x.lag ? (x.lag > 0 ? `+${x.lag}` : `${x.lag}`) : ''}`).join(', ');
  const aplicarTexto = (lid: number, t: TipoLigacao, s: string) => {
    const novos: Lig[] = [];
    for (const parte of s.split(/[,;\s]+/).filter(Boolean)) {
      const m = /^(\d+)\s*([+-]\s*\d+)?$/.exec(parte);
      const de = m ? ordem[Number(m[1]) - 1] : undefined;
      if (!m || de === undefined) { toast.error(`"${parte}" não é um nº de linha da sequência (ex.: 3 ou 3+2)`); return; }
      if (de === lid) { toast.error('a linha não pode depender dela mesma'); return; }
      novos.push({ de, tipo: t, lag: m[2] ? Number(m[2].replace(/\s/g, '')) : 0 });
    }
    setLigs((g) => ({ ...g, [lid]: [...(g[lid] ?? []).filter((x) => x.tipo !== t), ...novos] }));
    setSujo(true);
  };
  const mover = (de: number, para: number) => {
    if (de === para) return;
    setOrdem((o) => { const n = [...o]; const [x] = n.splice(de, 1); n.splice(para, 0, x); return n; });
    setSujo(true);
  };
  const cronologica = () => {
    // ordem topológica pelas ligações; entre as liberadas, a que começa antes (sem previsto vai para o fim)
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
    toast.success('Ordenado pelo 1º dia com previsto, respeitando as ligações');
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
    return m ? `${x.tipo} com nº ${pos.get(x.de)}: ${m}` : null;
  }).filter(Boolean) as string[];
  const nAlertas = ordem.reduce((s, lid) => s + alertas(lid).length, 0);

  if (!linhas.length) return <p className="rounded-m-lg border border-dashed border-m-stroke p-8 text-center text-sm text-m-text-secondary">Nenhuma linha programada ainda.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {editar && <Botao variante="secundario" onClick={cronologica}><ListOrdered size={16} /> Ordenar cronologicamente</Botao>}
        {editar && <Botao disabled={!sujo || salvando} onClick={salvar}><Save size={16} /> {salvando ? 'Salvando…' : 'Salvar sequência'}</Botao>}
        {sujo && <span className="text-[12.5px] font-semibold text-m-warning">alterações não salvas</span>}
        <span className={`text-[12.5px] ${nAlertas ? 'text-m-danger' : 'text-m-text-muted'}`}>{nAlertas ? `${nAlertas} ligação(ões) não respeitada(s) pelos dias programados` : 'Ligações conferidas com os dias programados'}</span>
        <span className="text-[12px] text-m-text-muted">Arraste as linhas (ou use ↑ ↓) · nas colunas, o nº da predecessora na sequência, com defasagem em dias: 3 · 3+2 · 3, 5</span>
      </div>
      <div className="overflow-x-auto rounded-m-lg border border-m-stroke-subtle bg-m-surface-raised">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.3px] text-m-text-muted">
              <th className="w-[70px] px-2 py-2">Nº</th><th className="px-2 py-2">Atividade</th><th className="px-2 py-2">Frente · área</th><th className="px-2 py-2">Encarregado</th>
              <th className="px-2 py-2">Início</th><th className="px-2 py-2">Fim</th>
              {TIPOS.map((x) => <th key={x.t} className="w-[90px] px-2 py-2" title={x.dica}>{x.rotulo}</th>)}
              <th className="px-2 py-2">Conferência</th>
            </tr>
          </thead>
          <tbody>
            {ordem.map((lid, i) => {
              const ln = porId.get(lid);
              if (!ln) return null;
              const al = alertas(lid);
              return (
                <tr key={lid} className={`border-b border-m-row ${arrastando === i ? 'opacity-40' : ''}`}
                  draggable={editar} onDragStart={(e) => { setArrastando(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
                  onDragEnd={() => setArrastando(null)}
                  onDragOver={(e) => { if (editar) e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); const de = Number(e.dataTransfer.getData('text/plain')); if (!Number.isNaN(de)) mover(de, i); setArrastando(null); }}>
                  <td className="whitespace-nowrap px-2 py-1.5">
                    <span className="inline-flex items-center gap-1">
                      {editar && <GripVertical size={14} className="cursor-grab text-m-text-muted" aria-hidden="true" />}
                      <b className="text-m-text-primary">{i + 1}</b>
                      {editar && <>
                        <button type="button" aria-label={`Subir ${ln.codigo_simova}`} disabled={i === 0} className="p-0.5 text-m-text-muted disabled:opacity-30" onClick={() => mover(i, i - 1)}><ArrowUp size={13} /></button>
                        <button type="button" aria-label={`Descer ${ln.codigo_simova}`} disabled={i === ordem.length - 1} className="p-0.5 text-m-text-muted disabled:opacity-30" onClick={() => mover(i, i + 1)}><ArrowDown size={13} /></button>
                      </>}
                    </span>
                  </td>
                  <td className="min-w-[260px] px-2 py-1.5"><b className="text-m-text-primary">{ln.codigo_simova}</b> {nomeLinha(ln, nomes)}{ln.cwp?.texto && <div className="text-[11px] text-m-text-muted">CWP {ln.cwp.texto}</div>}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-[12px]">{ln.onde}</td>
                  <td className="px-2 py-1.5 text-[12px]">{ln.encarregado ?? ln.equipe ?? '—'}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{ln.janela ? dataBR(ln.janela[0]) : '—'}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{ln.janela ? dataBR(ln.janela[1]) : '—'}</td>
                  {TIPOS.map((x) => {
                    const k = `${lid}|${x.t}`;
                    return (
                      <td key={x.t} className="px-1 py-1">
                        <input aria-label={`${x.rotulo} de ${ln.codigo_simova}`} title={x.dica} disabled={!editar} placeholder="—"
                          value={rasc[k] ?? texto(lid, x.t)}
                          onChange={(e) => setRasc({ ...rasc, [k]: e.target.value })}
                          onBlur={() => { if (rasc[k] !== undefined) { aplicarTexto(lid, x.t, rasc[k]); const n = { ...rasc }; delete n[k]; setRasc(n); } }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          className="h-8 w-[80px] rounded-[8px] border border-m-stroke bg-m-surface-field px-1.5 text-[13px] outline-none focus:border-m-accent disabled:border-transparent disabled:bg-transparent" />
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-[12px]">
                    {al.length ? al.map((a) => <div key={a} className="flex items-start gap-1 text-m-danger"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{a}</div>)
                      : (ligs[lid] ?? []).length ? <span className="inline-flex items-center gap-1 text-m-success"><CheckCircle2 size={13} /> ok</span> : <span className="text-m-text-tertiary">sem ligação</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-m-text-muted">A sequência salva vira a ordem das linhas na programação e no agrupamento por encarregado. Início e fim são o 1º e o último dia com previsto.</p>
    </div>
  );
}
