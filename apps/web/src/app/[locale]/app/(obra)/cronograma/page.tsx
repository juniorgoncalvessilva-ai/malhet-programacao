'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Filter, Send, X } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Chip, Erro, Painel, Pilula, Selecao, dataBR, fmt } from '@/components/Obra/ui';
import { Calculado, nbr, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { useEquipes } from '@/hooks/programacao/queries';
import { k, useAcao, useCatalogo, useFrentes2, useProgramacoes } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import type { AtividadeArvore } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

/* ---------- modelo da árvore ---------- */
interface No {
  nome: string; chave: string; codigo: string; ordem: string; p6: string | null; nivel: number;
  filhos: No[]; atividades: AtividadeArvore[];
  total: number; inicio: string | null; fim: string | null; pct: number | null; horas: number; atrasadas: number;
}
type Ordem = 'p6' | 'id' | 'atividade' | 'inicio' | 'fim' | 'dur' | 'pct';
const HOJE = new Date().toISOString().slice(0, 10);
const LIMITE_LISTA = 500;
const cmpTxt = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
const cwaDe = (a: AtividadeArvore) => a.caminho.join(' ').match(/CWA\s*([0-9]{3}\.[0-9]{2})/i)?.[1] ?? null;
const atrasada = (a: AtividadeArvore) => !!a.fim && a.fim < HOJE && (a.pct ?? 0) < 100 && a.status !== 'Concluída';

/* ---------- memória de cálculo (contas feitas nesta tela sobre o cronograma vigente) ---------- */
const ORIGEM_P6 = 'Cronograma vigente (XER do Primavera P6)';
const MAX_PASSOS = 60;
const corta = <T,>(xs: T[]) => xs.slice(0, MAX_PASSOS);
const resto = (n: number) => (n > MAX_PASSOS ? [`Mostrando ${MAX_PASSOS} de ${n} parcelas.`] : []);
function memDuracaoAtv(a: AtividadeArvore): MemoriaCalculo {
  return { chave: 'dur', titulo: `Duração de ${a.id_crono} (dias)`, valor: `${nbr((a.duracao_h ?? 0) / 8, 1)} dias`,
    formula: 'dias = duração em horas do P6 ÷ 8 h/dia',
    passos: [{ descricao: a.atividade, conta: `${nbr(a.duracao_h)} h ÷ 8`, resultado: `${nbr((a.duracao_h ?? 0) / 8, 2)} dias`, destaque: true }],
    fontes: [{ dado: 'Duração', valor: `${nbr(a.duracao_h)} h`, origem: ORIGEM_P6, local: `atividade ${a.id_crono} · duração planejada` }],
    notas: ['8 h/dia é o dia de referência usado para mostrar horas do P6 em dias.'] };
}
function memPctAtv(a: AtividadeArvore): MemoriaCalculo {
  return { chave: 'pct', titulo: `% físico de ${a.id_crono}`, valor: `${nbr(a.pct, 1)}%`, formula: 'valor do P6 (não é calculado aqui)',
    passos: [], fontes: [{ dado: '% concluído', valor: `${nbr(a.pct, 1)}%`, origem: ORIGEM_P6, local: `atividade ${a.id_crono} · ${a.status ?? ''}` }], notas: [] };
}
function memDuracaoNo(n: No): MemoriaCalculo {
  const partes = [...n.filhos.map((f) => ({ d: `${f.codigo} ${f.nome}`, h: f.horas })), ...n.atividades.map((a) => ({ d: `${a.id_crono} ${a.atividade}`, h: a.duracao_h ?? 0 }))];
  return { chave: 'dur', titulo: `Duração somada de ${n.codigo} ${n.nome}`, valor: `${nbr(n.horas / 8, 0)} dias`,
    formula: 'dias = Σ horas das atividades do agrupamento ÷ 8 h/dia (soma de esforço, não o prazo do início ao fim)',
    passos: [...corta(partes).map((x) => ({ descricao: x.d, conta: `${nbr(x.h)} h`, resultado: `${nbr(x.h / 8, 1)} dias`, destaque: false })),
      { descricao: 'Total', conta: `${nbr(n.horas)} h ÷ 8`, resultado: `${nbr(n.horas / 8, 1)} dias`, destaque: true }],
    fontes: [{ dado: 'Durações', valor: `${n.total} atividade(s)`, origem: ORIGEM_P6, local: `WBS ${n.codigo} ${n.nome}` }],
    notas: resto(partes.length) };
}
function memPctNo(n: No): MemoriaCalculo {
  const partes = [
    ...n.filhos.filter((f) => f.pct != null).map((f) => ({ d: `${f.codigo} ${f.nome}`, pct: f.pct as number, w: f.horas || f.total, base: f.horas ? 'h' : 'ativ.' })),
    ...n.atividades.filter((a) => a.pct != null).map((a) => ({ d: `${a.id_crono} ${a.atividade}`, pct: a.pct as number, w: a.duracao_h || 1, base: a.duracao_h ? 'h' : 'peso 1' })),
  ];
  const soma = partes.reduce((t, x) => t + x.pct * x.w, 0);
  const peso = partes.reduce((t, x) => t + x.w, 0);
  return { chave: 'pct', titulo: `% físico de ${n.codigo} ${n.nome}`, valor: `${nbr(n.pct, 1)}%`,
    formula: '% = Σ (% de cada parte × peso) ÷ Σ pesos — peso = horas de duração (sem horas: nº de atividades, ou 1)',
    passos: [...corta(partes).map((x) => ({ descricao: x.d, conta: `${nbr(x.pct, 1)}% × ${nbr(x.w)} ${x.base}`, resultado: nbr(x.pct * x.w, 1), destaque: false })),
      { descricao: 'Total', conta: `${nbr(soma, 1)} ÷ ${nbr(peso)}`, resultado: `${nbr(peso ? soma / peso : null, 1)}%`, destaque: true }],
    fontes: [{ dado: '% e duração das atividades', valor: `${n.total} atividade(s)`, origem: ORIGEM_P6, local: `WBS ${n.codigo} ${n.nome}` }],
    notas: resto(partes.length) };
}

function montarArvore(ativ: AtividadeArvore[], ordemP6: Map<string, number>): No {
  const novo = (nome: string, chave: string, nivel: number, ordem: string, p6: string | null): No => ({ nome, chave, codigo: '', ordem, p6, nivel, filhos: [], atividades: [], total: 0, inicio: null, fim: null, pct: null, horas: 0, atrasadas: 0 });
  const raiz = novo('', '', 0, '', null);
  const idx = new Map<string, No>();
  for (const a of ativ) {
    let no = raiz;
    a.caminho.forEach((parte, i) => {
      const chave = `${no.chave}/${parte}`;
      let f = idx.get(chave);
      // ordem e código da WBS do Primavera (seq_num e wbs_short_name); sem eles (importação antiga), a 1ª aparição
      const ordemNo = a.wbs_ordem?.[i] ?? String(ordemP6.get(a.id_crono) ?? 0).padStart(8, '0');
      if (!f) { f = novo(parte, chave, i + 1, ordemNo, a.wbs_codigos?.[i] ?? null); idx.set(chave, f); no.filhos.push(f); }
      no = f;
    });
    no.atividades.push(a);
  }
  // agrega de baixo para cima; código da WBS = o do P6 (5, 5.1, 5.1.11) ou, sem ele, a numeração 1, 1.2…
  const agregar = (n: No, codigo: string) => {
    n.codigo = codigo;
    let soma = 0; let peso = 0;
    const junta = (ini: string | null, fim: string | null) => {
      if (ini && (!n.inicio || ini < n.inicio)) n.inicio = ini;
      if (fim && (!n.fim || fim > n.fim)) n.fim = fim;
    };
    n.filhos.sort((x, y) => (x.ordem < y.ordem ? -1 : x.ordem > y.ordem ? 1 : 0)).forEach((f, i) => {
      const seg = f.p6 || String(i + 1);
      agregar(f, codigo ? `${codigo}.${seg}` : seg);
      n.total += f.total; n.horas += f.horas; n.atrasadas += f.atrasadas; junta(f.inicio, f.fim);
      if (f.pct != null) { const w = f.horas || f.total; soma += f.pct * w; peso += w; }
    });
    for (const a of n.atividades) {
      n.total++; n.horas += a.duracao_h ?? 0; if (atrasada(a)) n.atrasadas++; junta(a.inicio, a.fim);
      if (a.pct != null) { const w = a.duracao_h || 1; soma += a.pct * w; peso += w; }
    }
    n.pct = peso ? soma / peso : null;
  };
  agregar(raiz, '');
  return raiz;
}

/* ---------- filtro de vários valores ---------- */
function FiltroMulti({ rotulo, opcoes, valor, onChange }: { rotulo: string; opcoes: { v: string; n: number }[]; valor: Set<string>; onChange: (s: Set<string>) => void }) {
  const [busca, setBusca] = useState('');
  const vis = opcoes.filter((o) => !busca || o.v.toLowerCase().includes(busca.toLowerCase()));
  return (
    <details className="relative">
      <summary className={`flex h-[34px] cursor-pointer list-none items-center gap-1.5 rounded-full border px-3.5 text-[13px] ${valor.size ? 'border-m-accent bg-m-accent-subtle font-semibold text-m-accent' : 'border-m-stroke bg-m-surface-raised text-m-text-secondary'}`}>
        <Filter size={13} />{rotulo}{valor.size ? ` · ${valor.size}` : ''}<ChevronDown size={13} />
      </summary>
      <div className="absolute left-0 z-30 mt-1 w-[300px] rounded-m-lg border border-m-stroke bg-m-surface-raised p-2 shadow-lg">
        {opcoes.length > 8 && <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar…" aria-label={`Procurar em ${rotulo}`} className="mb-2 h-8 w-full rounded-[8px] border border-m-stroke bg-m-surface-field px-2 text-[13px]" />}
        <div className="max-h-[280px] overflow-auto">
          {vis.map((o) => (
            <label key={o.v} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-[13px] hover:bg-m-surface-hover">
              <input type="checkbox" checked={valor.has(o.v)} onChange={() => { const s = new Set(valor); if (s.has(o.v)) s.delete(o.v); else s.add(o.v); onChange(s); }} />
              <span className="min-w-0 flex-1 truncate" title={o.v}>{o.v}</span><span className="text-[11px] text-m-text-muted">{fmt(o.n, 0)}</span>
            </label>
          ))}
          {!vis.length && <div className="px-2 py-2 text-[12px] text-m-text-muted">Nada encontrado.</div>}
        </div>
        {valor.size > 0 && <button type="button" className="mt-1 w-full rounded-[8px] px-2 py-1.5 text-left text-[12px] font-semibold text-m-accent hover:bg-m-surface-hover" onClick={() => onChange(new Set())}>Limpar {rotulo.toLowerCase()}</button>}
      </div>
    </details>
  );
}

/* ---------- página ---------- */
export default function CronogramaPage() {
  const api = useApi();
  const { pode } = useObra();
  const dados = useQuery({ queryKey: ['cronograma-arvore'], queryFn: () => api.get<{ versao: { rotulo: string; carregado_em: string; ordem_p6?: boolean } | null; atividades: AtividadeArvore[] }>('/cronograma/arvore'), staleTime: 60_000 });
  const programacoes = useProgramacoes();
  const frentes = useFrentes2();
  const catalogo = useCatalogo();
  const equipes = useEquipes();
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState<Set<string>>(new Set());
  const [fOs, setFOs] = useState<Set<string>>(new Set());
  const [fCwa, setFCwa] = useState<Set<string>>(new Set());
  const [fSit, setFSit] = useState<Set<string>>(new Set());
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [ordem, setOrdem] = useState<{ k: Ordem; asc: boolean }>({ k: 'p6', asc: true });
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [destino, setDestino] = useState('');
  const [soPeriodo, setSoPeriodo] = useState(false);
  const [envio, setEnvio] = useState<{ grupo_id: string; tipo_id: string; equipe_id: string; natureza: string; usarNome: boolean; areas: Record<string, string>; qtd: Record<string, string> } | null>(null);

  const todas = dados.data?.atividades ?? [];
  const ordemP6 = useMemo(() => new Map(todas.map((a, i) => [a.id_crono, i])), [todas]);
  const porId = useMemo(() => new Map(todas.map((a) => [a.id_crono, a])), [todas]);
  const prog = programacoes.data?.find((p) => String(p.id) === destino);
  const contar = (f: (a: AtividadeArvore) => string | null) => {
    const c = new Map<string, number>();
    todas.forEach((a) => { const v = f(a); if (v) c.set(v, (c.get(v) ?? 0) + 1); });
    return [...c.entries()].map(([v, n]) => ({ v, n })).sort((x, y) => cmpTxt(x.v, y.v));
  };
  const opStatus = useMemo(() => contar((a) => a.status), [todas]); // eslint-disable-line react-hooks/exhaustive-deps
  const opOs = useMemo(() => contar((a) => a.caminho[0] ?? null), [todas]); // eslint-disable-line react-hooks/exhaustive-deps
  const opCwa = useMemo(() => contar((a) => { const c = cwaDe(a); return c ? `CWA ${c}` : null; }), [todas]); // eslint-disable-line react-hooks/exhaustive-deps
  const situacao = (a: AtividadeArvore) => [atrasada(a) ? 'Atrasada' : null, a.programada_em.length ? 'Já programada' : 'Não programada'].filter(Boolean) as string[];
  const opSit = useMemo(() => {
    const c = new Map<string, number>(); todas.forEach((a) => situacao(a).forEach((s) => c.set(s, (c.get(s) ?? 0) + 1)));
    return [...c.entries()].map(([v, n]) => ({ v, n }));
  }, [todas]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return todas.filter((a) => (!fStatus.size || (a.status && fStatus.has(a.status)))
      && (!fOs.size || fOs.has(a.caminho[0] ?? ''))
      && (!fCwa.size || fCwa.has(`CWA ${cwaDe(a)}`))
      && (!fSit.size || situacao(a).some((s) => fSit.has(s)))
      && (!de || (a.fim ?? '') >= de) && (!ate || (a.inicio ?? '9999') <= ate)
      && (!soPeriodo || !prog || ((a.inicio ?? '9999') <= prog.fim && (a.fim ?? '0000') >= prog.inicio))
      && (!t || a.id_crono.toLowerCase().includes(t) || a.atividade.toLowerCase().includes(t) || a.caminho.some((c) => c.toLowerCase().includes(t))));
  }, [todas, q, fStatus, fOs, fCwa, fSit, de, ate, soPeriodo, prog]); // eslint-disable-line react-hooks/exhaustive-deps
  const plano = q.trim().length >= 2;
  const arvore = useMemo(() => montarArvore(filtradas, ordemP6), [filtradas, ordemP6]);

  // ordenação (vale para a estrutura e para as atividades)
  const chaveAtv = (a: AtividadeArvore): string | number => ({ p6: ordemP6.get(a.id_crono) ?? 0, id: a.id_crono, atividade: a.atividade, inicio: a.inicio ?? '', fim: a.fim ?? '', dur: a.duracao_h ?? 0, pct: a.pct ?? 0 })[ordem.k];
  const chaveNo = (n: No): string | number => ({ p6: n.ordem, id: n.codigo, atividade: n.nome, inicio: n.inicio ?? '', fim: n.fim ?? '', dur: n.horas, pct: n.pct ?? 0 })[ordem.k];
  const cmp = (x: string | number, y: string | number) => (typeof x === 'number' && typeof y === 'number' ? x - y : cmpTxt(String(x), String(y))) * (ordem.asc ? 1 : -1);
  const ordenarAtv = (l: AtividadeArvore[]) => [...l].sort((a, b) => cmp(chaveAtv(a), chaveAtv(b)));
  const ordenarNos = (l: No[]) => [...l].sort((a, b) => cmp(chaveNo(a), chaveNo(b)));
  const clicarOrdem = (kk: Ordem) => setOrdem((o) => (o.k === kk ? { k: kk, asc: !o.asc } : { k: kk, asc: kk !== 'pct' }));

  // linha do tempo (Gantt) no intervalo visível
  const escala = useMemo(() => {
    const ini = arvore.inicio ?? HOJE; const fim = arvore.fim ?? HOJE;
    const t0 = new Date(`${ini.slice(0, 7)}-01T00:00:00`).getTime();
    const f = new Date(`${fim}T00:00:00`); const t1 = new Date(f.getFullYear(), f.getMonth() + 1, 1).getTime();
    const meses: { rot: string; pos: number }[] = [];
    for (let d = new Date(t0); d.getTime() < t1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) meses.push({ rot: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + `/${String(d.getFullYear()).slice(2)}`, pos: (d.getTime() - t0) / (t1 - t0) });
    const x = (iso: string) => Math.min(1, Math.max(0, (new Date(`${iso}T00:00:00`).getTime() - t0) / (t1 - t0)));
    return { meses: meses.length > 5 ? meses.filter((_, i) => i % Math.ceil(meses.length / 5) === 0) : meses, x, hoje: x(HOJE) };
  }, [arvore.inicio, arvore.fim]);
  const Barra = ({ ini, fim, pct, tipo }: { ini: string | null; fim: string | null; pct: number | null; tipo: 'no' | 'ok' | 'and' | 'atr' | 'nao' }) => {
    if (!ini || !fim) return <div className="relative h-4">{escala.hoje > 0 && escala.hoje < 1 && <div className="absolute -top-1 h-6 w-px bg-m-danger/60" style={{ left: `${escala.hoje * 100}%` }} aria-hidden="true" />}</div>;
    const l = escala.x(ini) * 100; const w = Math.max(0.6, escala.x(fim) * 100 - l);
    const cor = { no: 'border-m-text-secondary bg-m-surface-active', ok: 'border-m-accent bg-m-accent-subtle', and: 'border-m-info bg-m-info-subtle', atr: 'border-m-danger bg-m-danger-subtle', nao: 'border-m-stroke-strong bg-m-surface-raised' }[tipo];
    const fill = { no: 'bg-m-text-secondary', ok: 'bg-m-accent', and: 'bg-m-info', atr: 'bg-m-danger', nao: 'bg-m-text-muted' }[tipo];
    return (
      <div className="relative h-4">
        {escala.hoje > 0 && escala.hoje < 1 && <div className="absolute -top-1 h-6 w-px bg-m-danger/60" style={{ left: `${escala.hoje * 100}%` }} aria-hidden="true" />}
        <div className={`absolute top-0.5 overflow-hidden rounded-[4px] border ${cor} ${tipo === 'no' ? 'h-2.5' : 'h-3'}`} style={{ left: `${l}%`, width: `${w}%` }}>
          <div className={`h-full ${fill}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
        </div>
      </div>
    );
  };
  const tipoAtv = (a: AtividadeArvore) => (atrasada(a) ? 'atr' : a.status === 'Concluída' ? 'ok' : a.status === 'Em andamento' ? 'and' : 'nao') as 'atr' | 'ok' | 'and' | 'nao';
  const borda = { atr: 'border-l-m-danger', ok: 'border-l-m-accent', and: 'border-l-m-info', nao: 'border-l-transparent' };

  // envio para a programação
  const areas = frentes.data?.flatMap((l) => l.areas.filter((a) => a.ativo)) ?? [];
  const grupo = catalogo.data?.find((g) => String(g.id) === envio?.grupo_id);
  const alternar = (chave: string) => setAbertos((s) => { const n = new Set(s); if (n.has(chave)) n.delete(chave); else n.add(chave); return n; });
  const abrirAte = (nivel: number) => { const s = new Set<string>(); const vai = (n: No) => n.filhos.forEach((f) => { if (f.nivel <= nivel) { s.add(f.chave); vai(f); } }); vai(arvore); setAbertos(s); };
  const marcar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const abrirEnvio = () => {
    const ar: Record<string, string> = {};
    sel.forEach((id) => { const a = porId.get(id); const cwa = a ? cwaDe(a) : null; const m = areas.find((x) => x.cwa === cwa); ar[id] = m ? String(m.id) : ''; });
    setEnvio({ grupo_id: '', tipo_id: '', equipe_id: '', natureza: 'P', usarNome: false, areas: ar, qtd: {} });
  };
  const enviar = useAcao(async (a, _: void) => {
    if (!envio || !prog) return 0;
    let n = 0;
    for (const id of sel) {
      const at = porId.get(id);
      await a.post(`/programacoes/${prog.id}/linhas`, {
        area_id: Number(envio.areas[id]), tipo_id: Number(envio.tipo_id), id_crono: id,
        complemento: envio.usarNome && at ? at.atividade.slice(0, 120) : null,
        equipe_id: envio.equipe_id ? Number(envio.equipe_id) : null, natureza: envio.natureza,
        qtd_periodo: envio.qtd[id] ? Number(envio.qtd[id]) : null,
      });
      n++;
    }
    return n;
  }, [[...k.programacoes], ['programacao'], ['cronograma-arvore']]);
  const faltaArea = envio && [...sel].some((id) => !envio.areas[id]);
  const filtrosAtivos = [
    ...[...fStatus].map((v) => ({ v, tira: () => { const s = new Set(fStatus); s.delete(v); setFStatus(s); } })),
    ...[...fOs].map((v) => ({ v, tira: () => { const s = new Set(fOs); s.delete(v); setFOs(s); } })),
    ...[...fCwa].map((v) => ({ v, tira: () => { const s = new Set(fCwa); s.delete(v); setFCwa(s); } })),
    ...[...fSit].map((v) => ({ v, tira: () => { const s = new Set(fSit); s.delete(v); setFSit(s); } })),
    ...(de ? [{ v: `fim ≥ ${dataBR(de)}`, tira: () => setDe('') }] : []),
    ...(ate ? [{ v: `início ≤ ${dataBR(ate)}`, tira: () => setAte('') }] : []),
  ];
  const limparFiltros = () => { setFStatus(new Set()); setFOs(new Set()); setFCwa(new Set()); setFSit(new Set()); setDe(''); setAte(''); setQ(''); };

  /* ---------- linhas ---------- */
  const th = 'px-2 py-2 text-[10.5px] font-semibold uppercase tracking-[0.3px] text-m-text-muted whitespace-nowrap';
  const td = 'px-2 py-1.5 border-b border-m-row tabular-nums';
  const Cab = ({ k: kk, children, direita }: { k: Ordem; children: React.ReactNode; direita?: boolean }) => (
    <th className={`${th} ${direita ? 'text-right' : 'text-left'}`} aria-sort={ordem.k === kk ? (ordem.asc ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`inline-flex items-center gap-1 uppercase ${ordem.k === kk ? 'text-m-accent' : ''}`} onClick={() => clicarOrdem(kk)}>
        {children}{ordem.k === kk ? (ordem.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  );
  const linhaAtv = (a: AtividadeArvore, nivel: number, comCaminho = false) => {
    const tp = tipoAtv(a);
    return (
      <tr key={a.id_crono} className={`text-[12.5px] ${sel.has(a.id_crono) ? 'bg-m-accent-subtle' : 'hover:bg-m-surface-hover'}`}>
        <td className={`${td} border-l-[3px] ${borda[tp]}`}><input type="checkbox" aria-label={`Selecionar ${a.id_crono}`} checked={sel.has(a.id_crono)} onChange={() => marcar(a.id_crono)} disabled={!pode('encarregado')} /></td>
        <td className={`${td} whitespace-nowrap font-semibold text-m-text-primary`}>{a.id_crono}</td>
        <td className={`${td} min-w-[380px]`} style={{ paddingLeft: comCaminho ? 8 : 8 + nivel * 14 }}>
          {a.atividade}
          {comCaminho && <div className="text-[11px] text-m-text-muted">{a.caminho.slice(-3).join(' › ')}</div>}
        </td>
        <td className={`${td} whitespace-nowrap`}>{dataBR(a.inicio)}</td>
        <td className={`${td} whitespace-nowrap ${tp === 'atr' ? 'font-semibold text-m-danger' : ''}`}>{dataBR(a.fim)}</td>
        <td className={`${td} text-right`}>{a.duracao_h != null ? <Calculado chave="dur" memoria={() => memDuracaoAtv(a)}>{fmt(a.duracao_h / 8, 1)}</Calculado> : '—'}</td>
        <td className={`${td} text-right font-semibold`}>{a.pct != null ? <Calculado chave="pct" memoria={() => memPctAtv(a)} titulo="Ver de onde vem o %">{`${fmt(a.pct, 0)}%`}</Calculado> : '—'}</td>
        <td className={`${td} whitespace-nowrap`}>{tp === 'atr' ? <Pilula tom="perigo">Atrasada</Pilula> : a.status ? <Pilula tom={tp === 'ok' ? 'sucesso' : tp === 'and' ? 'info' : 'neutro'}>{a.status}</Pilula> : '—'}</td>
        <td className={`${td} w-[340px] min-w-[320px]`}><Barra ini={a.inicio} fim={a.fim} pct={a.pct} tipo={tp} /></td>
        <td className={`${td} text-[11px]`}>{a.programada_em.map((p) => <Link key={p.id} href={`/app/programacoes/${p.id}`} className="mr-2 whitespace-nowrap font-semibold text-m-accent">{p.titulo.replace('Programação ', '').split(' · ')[0]}</Link>)}</td>
      </tr>
    );
  };
  const renderNo = (no: No): React.ReactNode => ordenarNos(no.filhos).map((f) => {
    const aberto = abertos.has(f.chave);
    const estilo = f.nivel === 1 ? 'bg-m-accent-strong text-m-on-accent' : f.nivel === 2 ? 'bg-m-surface-active text-m-text-primary' : 'bg-m-surface-active/50 text-m-text-primary';
    return (
      <Fragment key={f.chave}>
        <tr className={`text-[12px] ${estilo}`}>
          <td className={`${td} border-l-[3px] ${f.atrasadas ? 'border-l-m-danger' : 'border-l-transparent'}`} />
          <td className={`${td} whitespace-nowrap font-semibold ${f.nivel === 1 ? '' : 'text-m-text-secondary'}`}>{f.codigo}</td>
          <td className={td} style={{ paddingLeft: 8 + (f.nivel - 1) * 14 }}>
            <button type="button" className={`inline-flex items-center gap-1 text-left font-semibold ${f.nivel === 1 ? 'uppercase tracking-[0.3px]' : ''}`} onClick={() => alternar(f.chave)} aria-expanded={aberto}>
              {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{f.nome}
              <span className={`ml-1 font-normal normal-case ${f.nivel === 1 ? 'opacity-80' : 'text-m-text-muted'}`}>({fmt(f.total, 0)}{f.atrasadas ? ` · ${f.atrasadas} atrasada${f.atrasadas > 1 ? 's' : ''}` : ''})</span>
            </button>
          </td>
          <td className={`${td} whitespace-nowrap font-semibold`}>{dataBR(f.inicio)}</td>
          <td className={`${td} whitespace-nowrap font-semibold`}>{dataBR(f.fim)}</td>
          <td className={`${td} text-right`}>{f.horas ? <Calculado chave="dur" memoria={() => memDuracaoNo(f)}>{fmt(f.horas / 8, 0)}</Calculado> : ''}</td>
          <td className={`${td} text-right font-bold`}>{f.pct != null ? <Calculado chave="pct" memoria={() => memPctNo(f)}>{`${fmt(f.pct, 0)}%`}</Calculado> : '—'}</td>
          <td className={td} />
          <td className={td}><Barra ini={f.inicio} fim={f.fim} pct={f.pct} tipo="no" /></td>
          <td className={td} />
        </tr>
        {aberto && <>{renderNo(f)}{ordenarAtv(f.atividades).map((a) => linhaAtv(a, f.nivel))}</>}
      </Fragment>
    );
  });

  return (
    <>
      <Cabecalho
        eyebrow="Programar · cronograma"
        titulo={dados.data?.versao ? `Cronograma vigente: ${dados.data.versao.rotulo}` : 'Nenhum cronograma importado'}
        descricao={<>A estrutura do Primavera como no P6: WBS na ordem do cronograma (O.S. 1 antes da O.S. 2) e com o código da WBS do P6 (5, 5.1, 5.1.11…), atividades na sequência do P6. Duração em dias de 8 h. Clique no cabeçalho para ordenar por outra coluna; &quot;ordem do P6&quot; volta à estrutura do Primavera.{dados.data?.versao && dados.data.versao.ordem_p6 === false && <> <b className="text-m-warning">Este cronograma foi importado antes: reimporte o .xer em <Link href="/app/importacoes" className="underline">Importações</Link> para usar a ordem e os códigos do P6.</b></>} Marque as tarefas e envie para a programação da semana ou do mês. {!dados.data?.versao && <Link href="/app/importacoes" className="font-semibold text-m-accent">Importar o .xer</Link>}</>}
      />
      <Painel
        titulo="Quais tarefas entram na programação?"
        subtitulo={`${fmt(filtradas.length, 0)} de ${fmt(todas.length, 0)} atividades · ${fmt(arvore.atrasadas, 0)} atrasada(s)${sel.size ? ` · ${sel.size} selecionada(s)` : ''}`}
        acoes={<div className="flex flex-wrap items-end gap-2">
          <Selecao rotulo="Enviar para" value={destino} onChange={(e) => setDestino(e.target.value)} className="min-w-[280px]">
            <option value="">Escolha a programação…</option>
            {programacoes.data?.filter((p) => p.status === 'rascunho').map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
          </Selecao>
          <Botao disabled={!sel.size || !prog || !pode('encarregado')} onClick={abrirEnvio}><Send size={16} /> Enviar {sel.size || ''}</Botao>
        </div>}
      >
        {/* filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ID, atividade, CWA, TAG…" aria-label="Buscar"
            className="h-[34px] w-[260px] rounded-full border border-m-stroke bg-m-surface-field px-4 text-[13px] outline-none focus:border-m-accent" />
          <FiltroMulti rotulo="Status" opcoes={opStatus} valor={fStatus} onChange={setFStatus} />
          <FiltroMulti rotulo="O.S. / nível 1" opcoes={opOs} valor={fOs} onChange={setFOs} />
          <FiltroMulti rotulo="CWA" opcoes={opCwa} valor={fCwa} onChange={setFCwa} />
          <FiltroMulti rotulo="Situação" opcoes={opSit} valor={fSit} onChange={setFSit} />
          <label className="flex items-center gap-1.5 text-[12px] text-m-text-secondary">Fim a partir de<input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-[34px] rounded-full border border-m-stroke bg-m-surface-field px-3 text-[12px]" /></label>
          <label className="flex items-center gap-1.5 text-[12px] text-m-text-secondary">Início até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-[34px] rounded-full border border-m-stroke bg-m-surface-field px-3 text-[12px]" /></label>
          <label className="flex items-center gap-2 text-[12px] text-m-text-secondary"><input type="checkbox" checked={soPeriodo} disabled={!prog} onChange={(e) => setSoPeriodo(e.target.checked)} /> No período da programação</label>
        </div>
        {(filtrosAtivos.length > 0 || q) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {filtrosAtivos.map((f) => (
              <span key={f.v} className="inline-flex items-center gap-1 rounded-full bg-m-accent-subtle px-2.5 py-1 text-[12px] font-medium text-m-accent">
                {f.v}<button type="button" aria-label={`Tirar filtro ${f.v}`} onClick={f.tira}><X size={12} /></button>
              </span>
            ))}
            <button type="button" className="ml-1 text-[12px] font-semibold text-m-text-secondary underline" onClick={limparFiltros}>Limpar filtros</button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-m-text-secondary">
          {!plano && <>
            <span>Abrir:</span>
            {[1, 2, 3, 4].map((n) => <Chip key={n} ativo={false} onClick={() => abrirAte(n)}>Nível {n}</Chip>)}
            <Chip ativo={false} onClick={() => abrirAte(99)}>Tudo</Chip>
            <Chip ativo={false} onClick={() => setAbertos(new Set())}>Recolher</Chip>
          </>}
          <span className="ml-auto inline-flex flex-wrap items-center gap-3">
            {[['bg-m-danger', 'Atrasada'], ['bg-m-info', 'Em andamento'], ['bg-m-accent', 'Concluída'], ['bg-m-text-muted', 'Não iniciada']].map(([c, r]) => <span key={r} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-4 rounded-[3px] ${c}`} />{r}</span>)}
            {sel.size > 0 && <button type="button" className="font-semibold underline" onClick={() => setSel(new Set())}>Limpar seleção</button>}
          </span>
        </div>

        {envio && prog && (
          <div className="rounded-m-lg border border-m-accent/40 bg-m-accent-subtle/40 p-4">
            <div className="mb-3 text-sm font-semibold text-m-text-primary">Enviar {sel.size} tarefa(s) para {prog.titulo}</div>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              <Selecao rotulo="Grupo" required value={envio.grupo_id} onChange={(e) => setEnvio({ ...envio, grupo_id: e.target.value, tipo_id: '' })}>
                <option value="">Escolha…</option>
                {catalogo.data?.filter((g) => g.ativo).map((g) => <option key={g.id} value={g.id}>{g.codigo} · {g.descricao}</option>)}
              </Selecao>
              <Selecao rotulo="Atividade (item da PQ)" required value={envio.tipo_id} onChange={(e) => setEnvio({ ...envio, tipo_id: e.target.value })}>
                <option value="">{grupo ? 'Escolha…' : 'Escolha o grupo'}</option>
                {grupo?.tipos.filter((t) => t.ativo).map((t) => <option key={t.id} value={t.id}>{t.codigo} · {t.item_pq ? `${t.item_pq} · ` : ''}{t.descricao.slice(0, 80)}</option>)}
              </Selecao>
              <Selecao rotulo="Equipe" value={envio.equipe_id} onChange={(e) => setEnvio({ ...envio, equipe_id: e.target.value })}>
                <option value="">—</option>
                {equipes.data?.filter((e) => e.ativo).map((e) => <option key={e.id} value={e.id}>{e.codigo_simova ? `${e.codigo_simova} · ` : ''}{e.nome} · {e.encarregado_nome ?? ''} · {e.turno ?? 'Diurno'}</option>)}
              </Selecao>
              <Selecao rotulo="Natureza" value={envio.natureza} onChange={(e) => setEnvio({ ...envio, natureza: e.target.value })}>
                <option value="P">P · Programada</option><option value="O">O · Oportunidade</option><option value="E">E · Emergencial</option>
              </Selecao>
              <label className="flex items-end gap-2 pb-2.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={envio.usarNome} onChange={(e) => setEnvio({ ...envio, usarNome: e.target.checked })} /> Nome da tarefa como texto complementar (novo ID Simova)</label>
            </div>
            <table className="mt-3 w-full text-[13px]">
              <thead><tr className="text-[11px] uppercase text-m-text-muted"><th className="px-2 py-1 text-left">Tarefa</th><th className="px-2 py-1 text-left">Área (pelo CWA)</th><th className="px-2 py-1 text-right">Prev. no período</th></tr></thead>
              <tbody>
                {[...sel].map((id) => {
                  const a = porId.get(id);
                  return (
                    <tr key={id} className="border-t border-m-stroke-subtle">
                      <td className="px-2 py-1.5"><b>{id}</b> · {a?.atividade}</td>
                      <td className="px-2 py-1.5">
                        <select aria-label={`Área de ${id}`} value={envio.areas[id] ?? ''} onChange={(e) => setEnvio({ ...envio, areas: { ...envio.areas, [id]: e.target.value } })}
                          className={`h-9 w-full rounded-m-md border bg-m-surface-field px-2 text-[13px] ${envio.areas[id] ? 'border-m-stroke' : 'border-m-warning'}`}>
                          <option value="">{a && cwaDe(a) ? `CWA ${cwaDe(a)} não cadastrado — escolha` : 'Escolha a área…'}</option>
                          {areas.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.descricao}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input aria-label={`Previsto no período de ${id}`} type="number" min="0" step="any" value={envio.qtd[id] ?? ''} onChange={(e) => setEnvio({ ...envio, qtd: { ...envio.qtd, [id]: e.target.value } })}
                          className="h-9 w-[100px] rounded-m-md border border-m-stroke bg-m-surface-field px-2 text-right" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 flex items-center gap-2">
              <Botao disabled={!envio.tipo_id || !!faltaArea || enviar.isPending} onClick={() => enviar.mutate(undefined, {
                onSuccess: (n) => { toast.success(`${n} tarefa(s) enviada(s) para ${prog.titulo}`); setEnvio(null); setSel(new Set()); },
              })}><Send size={16} /> Confirmar envio</Botao>
              <Botao variante="secundario" onClick={() => setEnvio(null)}>Cancelar</Botao>
              <Link href={`/app/programacoes/${prog.id}`} className="text-sm font-semibold text-m-accent">Abrir a programação</Link>
              <Erro erro={enviar.error} />
            </div>
          </div>
        )}

        <div className="-mx-1 max-h-[72vh] overflow-auto px-1">
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-m-surface-raised">
              <tr>
                <th colSpan={3} className="rounded-t-[8px] bg-m-surface-active px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-secondary">Estrutura (WBS)</th>
                <th colSpan={3} className="rounded-t-[8px] bg-m-info-subtle px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.4px] text-m-info">Datas</th>
                <th colSpan={2} className="rounded-t-[8px] bg-m-accent-subtle px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.4px] text-m-accent">Avanço</th>
                <th className="rounded-t-[8px] bg-m-surface-active px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-secondary">Linha do tempo</th>
                <th />
              </tr>
              <tr>
                <th className={`${th} w-8`} />
                <Cab k="id">ID / WBS</Cab>
                <th className={`${th} text-left`}>
                  <span className="inline-flex items-center gap-3">
                    <button type="button" className={`inline-flex items-center gap-1 uppercase ${ordem.k === 'atividade' ? 'text-m-accent' : ''}`} onClick={() => clicarOrdem('atividade')}>Atividade{ordem.k === 'atividade' ? (ordem.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}</button>
                    <button type="button" className={`inline-flex items-center gap-1 normal-case ${ordem.k === 'p6' ? 'text-m-accent' : ''}`} onClick={() => clicarOrdem('p6')}>ordem do P6{ordem.k === 'p6' ? (ordem.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null}</button>
                  </span>
                </th>
                <Cab k="inicio">Início</Cab>
                <Cab k="fim">Fim</Cab>
                <Cab k="dur" direita>Dur. (d)</Cab>
                <Cab k="pct" direita>% físico</Cab>
                <th className={`${th} text-left`}>Status</th>
                <th className={`${th} text-left`}>
                  <div className="relative h-4">
                    {escala.meses.map((m) => <span key={`${m.rot}${m.pos}`} className="absolute text-[10px] normal-case tracking-normal" style={{ left: `${m.pos * 100}%` }}>{m.rot}</span>)}
                  </div>
                </th>
                <th className={`${th} text-left`}>Programada em</th>
              </tr>
            </thead>
            <tbody>
              {dados.isLoading && <tr><td colSpan={10} className="py-8 text-center text-m-text-muted">Carregando o cronograma…</td></tr>}
              {plano
                ? ordenarAtv(filtradas).slice(0, LIMITE_LISTA).map((a) => linhaAtv(a, 0, true))
                : <>{renderNo(arvore)}{ordenarAtv(arvore.atividades).map((a) => linhaAtv(a, 0))}</>}
              {plano && filtradas.length > LIMITE_LISTA && <tr><td colSpan={10} className="py-3 text-center text-xs text-m-text-muted">Mostrando {LIMITE_LISTA} de {fmt(filtradas.length, 0)}: refine a busca ou os filtros.</td></tr>}
              {!dados.isLoading && !filtradas.length && <tr><td colSpan={10} className="py-8 text-center text-m-text-muted">Nenhuma atividade com esses filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-m-text-muted">Linha vertical da linha do tempo: hoje ({dataBR(HOJE)}). % da estrutura ponderado pela duração.</p>
      </Painel>
    </>
  );
}
