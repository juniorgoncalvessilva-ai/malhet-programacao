'use client';

import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Maximize2, Minimize2, Minus, Plus, ScanSearch, UserPlus, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Colaborador, CoresOrganograma, NoOrganograma } from '@/lib/api/types';
import { BuscaEfetivo } from '@/components/Obra/BuscaEfetivo';
import { ExportarOrganograma, type ConteudoExportacao } from '@/components/Obra/ExportarOrganograma';
import styles from './OrganogramaArvore.module.css';

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 1.6;
const LISTA_LONGA = 12;
// Níveis por tipo de caixa (abre tudo o que está acima do tipo escolhido): funciona com ou sem responsável/supervisor
const ORDEM: Record<NoOrganograma['tipo'], number> = { obra: 0, setor: 1, responsavel: 2, supervisor: 3, disciplina: 4, frente: 4, area: 5, equipe: 6, funcao: 7 };
const NIVEIS_SETOR = [
  { n: 1, rotulo: 'Setores' }, { n: 2, rotulo: 'Responsáveis' }, { n: 3, rotulo: 'Supervisores' }, { n: 4, rotulo: 'Disciplinas' },
  { n: 6, rotulo: 'Equipes' }, { n: 99, rotulo: 'Funções' },
];
const NIVEIS_FRENTE = [
  { n: 1, rotulo: 'Setores' }, { n: 2, rotulo: 'Responsáveis' }, { n: 3, rotulo: 'Supervisores' }, { n: 4, rotulo: 'Frentes' },
  { n: 5, rotulo: 'Áreas' }, { n: 6, rotulo: 'Equipes' }, { n: 99, rotulo: 'Funções' },
];
const CORES_PADRAO: CoresOrganograma = { obra: '#1F3A3A', setor: '#0F766E', responsavel: '#4F46E5', supervisor: '#7C3AED', disciplina: '#0891B2', frente: '#B45309', area: '#D97706', equipe: '#2563EB', funcao: '#64748B' };
const RAMOS_ESPECIAIS = new Set(['Sem equipe', 'Em mobilização', 'Sem setor']);

/** Pessoa que pode ser selecionada/arrastada: crachá (ou matrícula) e a equipe de onde sai (null = sem equipe). */
export interface PessoaRef { cracha: string; nome: string; de: number | null }
export const chavePessoa = (p: PessoaRef) => `${p.de ?? 'x'}|${p.cracha}`;
const TIPO_DND = 'application/x-malhet-pessoas';

/** Espessura das linhas e bordas (tela, apresentação e impressão) — spec 058. */
const ESPESSURAS = {
  fina: { rotulo: 'Fina', linha: 1, borda: 1, cor: 'var(--m-stroke)' },
  media: { rotulo: 'Média', linha: 2, borda: 1.5, cor: 'color-mix(in srgb, var(--m-text-primary) 45%, transparent)' },
  grossa: { rotulo: 'Grossa', linha: 3, borda: 2, cor: 'color-mix(in srgb, var(--m-text-primary) 60%, transparent)' },
  extra: { rotulo: 'Extra', linha: 4, borda: 2.5, cor: 'color-mix(in srgb, var(--m-text-primary) 75%, transparent)' },
} as const;
type Espessura = keyof typeof ESPESSURAS;
const CHAVE_ESPESSURA = 'malhet.organograma.linhas';

/** Ids das funções (folhas com pessoas) para abrir os nomes. */
function folhasComPessoas(raiz: NoOrganograma): Set<string> {
  const out = new Set<string>();
  const ir = (no: NoOrganograma) => { if (!no.filhos.length && no.pessoas.length) out.add(no.id); no.filhos.forEach(ir); };
  ir(raiz);
  return out;
}

/** Mexer nas equipes pelo organograma (specs 049 e 052): selecionar, arrastar, mover, tirar e incluir pessoas/funções. */
export interface EdicaoOrganograma {
  equipes: { id: number; nome: string; encarregado?: string | null }[];
  efetivo: Colaborador[];
  selecionadas: Map<string, PessoaRef>;
  alternar: (p: PessoaRef[], marcar?: boolean) => void;
  mover: (itens: PessoaRef[], para: number | null) => Promise<unknown>; // para null = tirar da equipe
  equipesSel: Set<number>;
  alternarEquipe: (id: number) => void;
}

/** Texto da equipe nas listas de mover/migrar: nome + encarregado, para achar a equipe pelo encarregado (spec 057). */
export function rotuloEquipe(e: { nome: string; encarregado?: string | null }): string {
  return e.encarregado ? `${e.nome} — Enc. ${e.encarregado}` : `${e.nome} — sem encarregado`;
}

/** ids dos nós que, até a profundidade `nivel`, ficam abertos (mostram os filhos). */
function abertosAte(raiz: NoOrganograma, nivel: number): Set<string> {
  const out = new Set<string>();
  const ir = (no: NoOrganograma, prof: number) => {
    if (ORDEM[no.tipo] >= nivel || !no.filhos.length) return;
    // listas longas de funções (Sem equipe, Em mobilização) só abrem no nível "Funções" ou no clique
    if (nivel < 99 && no.filhos.length > LISTA_LONGA && no.filhos.every((f) => !f.filhos.length)) return;
    out.add(no.id);
    no.filhos.forEach((f) => ir(f, prof + 1));
  };
  ir(raiz, 0);
  return out;
}

/**
 * Árvore do organograma (modelo do Malhet) com ramos recolhíveis, zoom (botões, Ctrl + rolagem, ajustar à tela),
 * arrastar para navegar e tela cheia. Clique numa função para ver as pessoas.
 */
export function OrganogramaArvore({ raiz, ariaLabel, expandirTudo = false, cores: coresIn, acoes, porFrente = false, edicao, chaveBusca = '', tituloExportacao = 'Organograma da obra' }: {
  raiz: NoOrganograma; ariaLabel: string; expandirTudo?: boolean; cores?: CoresOrganograma; acoes?: React.ReactNode; porFrente?: boolean;
  edicao?: EdicaoOrganograma; tituloExportacao?: string; chaveBusca?: string; // nova busca reabre a árvore; recarga dos dados (tempo real) mantém o que está aberto
}) {
  const cores = { ...CORES_PADRAO, ...coresIn };
  const NIVEIS = porFrente ? NIVEIS_FRENTE : NIVEIS_SETOR;
  const NIVEL_PADRAO = 6; // até as equipes
  const legenda = porFrente ? (['obra', 'setor', 'responsavel', 'supervisor', 'frente', 'area', 'equipe', 'funcao'] as const) : (['obra', 'setor', 'responsavel', 'supervisor', 'disciplina', 'equipe', 'funcao'] as const);
  const [nivel, setNivel] = useState(expandirTudo ? 99 : NIVEL_PADRAO);
  const [abertos, setAbertos] = useState<Set<string>>(() => abertosAte(raiz, expandirTudo ? 99 : NIVEL_PADRAO));
  const [pessoas, setPessoas] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [cheia, setCheia] = useState(false);
  const janela = useRef<HTMLDivElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const arrasto = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const [menuExpandir, setMenuExpandir] = useState(false);
  const [espessura, setEspessura] = useState<Espessura>(() => {
    try { const v = localStorage.getItem(CHAVE_ESPESSURA) as Espessura | null; return v && v in ESPESSURAS ? v : 'fina'; } catch { return 'fina'; }
  });
  const trocarEspessura = (v: Espessura) => { setEspessura(v); try { localStorage.setItem(CHAVE_ESPESSURA, v); } catch { /* sem armazenamento */ } };
  const esp = ESPESSURAS[espessura];

  // nova árvore (busca) → reabre no nível escolhido; com busca, abre tudo para mostrar os achados
  useEffect(() => { const n = expandirTudo ? 99 : nivel; setAbertos(abertosAte(raiz, n)); }, [chaveBusca, expandirTudo]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = conteudo.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTam({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ao carregar e ao trocar o nível, mostra o topo da árvore centralizado
  const centrar = useRef(true);
  useEffect(() => { centrar.current = true; }, [raiz, nivel]);
  useEffect(() => {
    const j = janela.current;
    if (!j || !tam.w || !centrar.current) return;
    centrar.current = false;
    j.scrollTo({ left: Math.max(0, (tam.w * zoom - j.clientWidth) / 2), top: 0 });
  }, [tam, zoom]);

  const ajustar = useCallback(() => {
    const j = janela.current;
    if (!j || !tam.w) return;
    const z = Math.min((j.clientWidth - 16) / tam.w, (j.clientHeight - 16) / tam.h, 1);
    setZoom(Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
    j.scrollTo({ left: 0, top: 0 });
  }, [tam]);

  const mudarZoom = useCallback((novo: (z: number) => number, foco?: { x: number; y: number }) => {
    const j = janela.current;
    setZoom((z) => {
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(novo(z) * 100) / 100));
      if (j) {
        // mantém o ponto sob o cursor (ou o centro) no mesmo lugar
        const fx = foco?.x ?? j.clientWidth / 2;
        const fy = foco?.y ?? j.clientHeight / 2;
        const cx = (j.scrollLeft + fx) / z;
        const cy = (j.scrollTop + fy) / z;
        requestAnimationFrame(() => j.scrollTo({ left: cx * nz - fx, top: cy * nz - fy }));
      }
      return nz;
    });
  }, []);

  // Ctrl/⌘ + rolagem = zoom (listener não passivo para impedir o zoom da página)
  useEffect(() => {
    const j = janela.current;
    if (!j) return;
    const roda = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = j.getBoundingClientRect();
      mudarZoom((z) => z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    j.addEventListener('wheel', roda, { passive: false });
    return () => j.removeEventListener('wheel', roda);
  }, [mudarZoom]);

  useEffect(() => {
    if (!cheia) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCheia(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [cheia]);

  const escolherNivel = (n: number) => { setNivel(n); setAbertos(abertosAte(raiz, n)); if (n <= 1) setPessoas(new Set()); };
  const expandir = (comNomes: boolean) => { escolherNivel(99); setPessoas(comNomes ? folhasComPessoas(raiz) : new Set()); setMenuExpandir(false); };
  useEffect(() => {
    if (!menuExpandir) return;
    const fora = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[data-menu-expandir]')) setMenuExpandir(false); };
    window.addEventListener('mousedown', fora);
    return () => window.removeEventListener('mousedown', fora);
  }, [menuExpandir]);
  // exportação: abre a árvore como pedido e devolve como voltar ao que estava na tela
  const preparar = (c: ConteudoExportacao) => {
    const antes = { abertos, pessoas };
    if (c !== 'tela') { setAbertos(abertosAte(raiz, 99)); setPessoas(c === 'nomes' ? folhasComPessoas(raiz) : new Set()); }
    return () => { setAbertos(antes.abertos); setPessoas(antes.pessoas); };
  };
  const alternar = (id: string) => setAbertos((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alternarPessoas = (id: string) => setPessoas((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const visiveis = useMemo(() => { let n = 0; const ir = (no: NoOrganograma) => { n++; if (abertos.has(no.id)) no.filhos.forEach(ir); }; ir(raiz); return n; }, [raiz, abertos]);

  const botao = 'inline-flex h-8 items-center gap-1.5 rounded-full border border-m-stroke bg-m-surface-raised px-3 text-[12.5px] font-medium text-m-text-primary hover:bg-m-surface-hover disabled:opacity-50';
  return (
    <div className={cn('flex flex-col gap-2', cheia && 'fixed inset-0 z-[90] bg-m-surface-base p-4')}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-m-stroke bg-m-surface-raised p-0.5" role="group" aria-label="Mostrar até o nível">
          {NIVEIS.map((x) => (
            <button key={x.n} type="button" aria-pressed={nivel === x.n} onClick={() => escolherNivel(x.n)}
              className={cn('h-7 rounded-full px-3 text-[12.5px] font-medium', nivel === x.n ? 'bg-m-accent text-white' : 'text-m-text-secondary hover:bg-m-surface-hover')}>{x.rotulo}</button>
          ))}
        </div>
        <div className="relative" data-menu-expandir>
          <button type="button" className={botao} aria-haspopup="menu" aria-expanded={menuExpandir} onClick={() => setMenuExpandir((m) => !m)}>
            <ChevronsUpDown size={14} /> Expandir tudo <ChevronDown size={13} />
          </button>
          {menuExpandir && (
            <div role="menu" className="absolute left-0 top-9 z-30 flex w-64 flex-col rounded-m-md border border-m-stroke bg-m-surface-raised p-1 shadow-lg">
              <button type="button" role="menuitem" className="rounded-[8px] px-3 py-2 text-left text-[12.5px] hover:bg-m-surface-hover" onClick={() => expandir(false)}>
                <b className="block text-m-text-primary">Só as caixas</b><span className="text-m-text-muted">abre todos os níveis, sem os nomes</span>
              </button>
              <button type="button" role="menuitem" className="rounded-[8px] px-3 py-2 text-left text-[12.5px] hover:bg-m-surface-hover" onClick={() => expandir(true)}>
                <b className="block text-m-text-primary">Com os nomes das pessoas</b><span className="text-m-text-muted">abre tudo e lista as pessoas de cada função</span>
              </button>
            </div>
          )}
        </div>
        <button type="button" className={botao} onClick={() => escolherNivel(1)}><ChevronsDownUp size={14} /> Recolher tudo</button>
        <span className="text-[12px] text-m-text-muted">{visiveis} caixas visíveis</span>
        <span className="flex items-center gap-2.5 text-[11.5px] text-m-text-secondary" aria-label="Cores dos níveis">
          {legenda.map((n) => (
            <span key={n} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: cores[n] }} aria-hidden="true" />{ROTULO_TIPO[n]}</span>
          ))}
        </span>
        {acoes}
        <label className="inline-flex items-center gap-1.5 text-[12px] text-m-text-secondary">Linhas
          <select aria-label="Espessura das linhas" value={espessura} onChange={(e) => trocarEspessura(e.target.value as Espessura)}
            className="h-8 rounded-full border border-m-stroke bg-m-surface-raised px-2 text-[12.5px] text-m-text-primary">
            {(Object.keys(ESPESSURAS) as Espessura[]).map((k) => <option key={k} value={k}>{ESPESSURAS[k].rotulo} ({ESPESSURAS[k].linha} px)</option>)}
          </select>
        </label>
        <ExportarOrganograma className={botao} alvo={() => conteudo.current} preparar={preparar} tituloPadrao={tituloExportacao} pessoas={raiz.qtd} />
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className={botao} aria-label="Diminuir zoom" disabled={zoom <= ZOOM_MIN} onClick={() => mudarZoom((z) => z - 0.1)}><Minus size={14} /></button>
          <button type="button" className={cn(botao, 'w-16 justify-center tabular-nums')} title="Voltar a 100%" onClick={() => mudarZoom(() => 1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" className={botao} aria-label="Aumentar zoom" disabled={zoom >= ZOOM_MAX} onClick={() => mudarZoom((z) => z + 0.1)}><Plus size={14} /></button>
          <button type="button" className={botao} onClick={ajustar}><ScanSearch size={14} /> Ajustar à tela</button>
          <button type="button" className={botao} aria-label={cheia ? 'Sair da tela cheia' : 'Tela cheia'} onClick={() => setCheia((c) => !c)}>{cheia ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
        </div>
      </div>
      <div
        ref={janela}
        className={cn(styles.janela, cheia ? 'flex-1' : 'h-[68vh]')}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button, select, input, label, [role=listbox], [draggable=true]')) return;
          const j = janela.current!;
          arrasto.current = { x: e.clientX, y: e.clientY, l: j.scrollLeft, t: j.scrollTop };
          j.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const a = arrasto.current;
          if (!a) return;
          janela.current!.scrollTo({ left: a.l - (e.clientX - a.x), top: a.t - (e.clientY - a.y) });
        }}
        onPointerUp={() => { arrasto.current = null; }}
        onPointerCancel={() => { arrasto.current = null; }}
      >
        <div style={{ width: Math.max(tam.w * zoom, 1), height: Math.max(tam.h * zoom, 1) }} className="mx-auto">
          <div ref={conteudo} className={styles.conteudo}
            style={{ transform: `scale(${zoom})`, '--linha': `${esp.linha}px`, '--borda': `${esp.borda}px`, '--linha-cor': esp.cor } as React.CSSProperties}>
            <ul className={styles.arvore} aria-label={ariaLabel}>
              <Ramo no={raiz} abertos={abertos} alternar={alternar} pessoas={pessoas} alternarPessoas={alternarPessoas} cores={cores} corSetor={null} edicao={edicao} />
            </ul>
          </div>
        </div>
      </div>
      <p className="text-[11.5px] text-m-text-muted">{edicao ? 'Edição: marque pessoas e arraste (uma ou várias) para o cartão de uma equipe, ou para "Sem equipe" para tirar · arraste a função inteira pelo cartão dela · ' : ''}Arraste para navegar · Ctrl + rolagem para zoom · +/− abre ou recolhe um ramo · clique numa função para ver as pessoas{cheia ? ' · Esc sai da tela cheia' : ''}.</p>
    </div>
  );
}

type PropsRamo = {
  no: NoOrganograma; abertos: Set<string>; alternar: (id: string) => void; pessoas: Set<string>; alternarPessoas: (id: string) => void;
  cores: CoresOrganograma; corSetor: string | null; // cor própria do setor, herdada pelas equipes e funções dele
  edicao?: EdicaoOrganograma;
};

/** Nomes por coluna dentro da caixa: listas longas viram colunas (a caixa alarga em vez de virar uma tira). */
const NOMES_POR_COLUNA = 15;
const colunasDeNomes = (n: number) => Math.min(4, Math.max(1, Math.ceil(n / NOMES_POR_COLUNA)));
/** Altura aproximada da caixa em "caixas" (uma caixa fechada = 1; cada nome ≈ 0,3). */
function pesoFolha(f: NoOrganograma, pessoas: Set<string>): number {
  if (!pessoas.has(f.id) || !f.pessoas.length) return 1;
  return 1 + Math.ceil(f.pessoas.length / colunasDeNomes(f.pessoas.length)) * 0.3;
}
const ALTURA_COLUNA = 10; // até ~10 caixas empilhadas por coluna
/** Funções empilhadas divididas em colunas de altura parecida, na ordem (ramos longos não viram uma tira). */
function dividirEmColunas(filhos: NoOrganograma[], pessoas: Set<string>): NoOrganograma[][] {
  const pesos = filhos.map((f) => pesoFolha(f, pessoas));
  const total = pesos.reduce((s, x) => s + x, 0);
  if (total <= ALTURA_COLUNA || filhos.length < 2) return [filhos];
  const n = Math.min(8, filhos.length, Math.ceil(total / ALTURA_COLUNA));
  const alvo = total / n;
  const out: NoOrganograma[][] = [[]];
  let acc = 0;
  filhos.forEach((f, i) => {
    const atual = out[out.length - 1];
    if (atual.length && acc + pesos[i] / 2 > alvo && out.length < n) { out.push([f]); acc = pesos[i]; return; }
    atual.push(f); acc += pesos[i];
  });
  return out;
}

function Ramo(props: PropsRamo) {
  const { no, abertos } = props;
  const aberto = abertos.has(no.id);
  const temFilhos = no.filhos.length > 0;
  // filhos que são todos folhas (funções) empilham na vertical: a árvore fica estreita
  const empilhar = temFilhos && no.filhos.every((f) => !f.filhos.length);
  // cor própria do setor/disciplina passa para o ramo; disciplina sem cor herda a do setor
  const corFilhos = no.tipo === 'setor' ? no.cor : no.tipo === 'disciplina' ? (no.cor ?? props.corSetor) : props.corSetor;
  return (
    <li className={styles.no}>
      <Caixa {...props} />
      {temFilhos && aberto && (
        <>
          <span className={styles.haste} aria-hidden="true" />
          {empilhar
            ? (() => {
              const grupos = dividirEmColunas(no.filhos, props.pessoas);
              const coluna = (g: NoOrganograma[]) => <ul className={styles.coluna}>{g.map((f) => <li key={f.id}><Caixa {...props} corSetor={corFilhos} no={f} /></li>)}</ul>;
              return grupos.length === 1 ? coluna(grupos[0]) : <ul>{grupos.map((g) => <li key={g[0].id} className={styles.no}>{coluna(g)}</li>)}</ul>;
            })()
            : <ul>{no.filhos.map((f) => <Ramo key={f.id} {...props} corSetor={corFilhos} no={f} />)}</ul>}
        </>
      )}
    </li>
  );
}

function corDaCaixa(no: NoOrganograma, cores: CoresOrganograma, corSetor: string | null): string {
  if (no.tipo === 'setor') return no.cor ?? (RAMOS_ESPECIAIS.has(no.titulo) ? cores.funcao : cores.setor);
  if (no.tipo === 'obra') return cores.obra;
  if (no.tipo === 'disciplina') return no.cor ?? corSetor ?? cores.disciplina;
  if (no.tipo === 'responsavel') return cores.responsavel ?? corSetor ?? cores.setor;
  if (no.tipo === 'supervisor') return cores.supervisor ?? corSetor ?? cores.setor;
  return corSetor ?? cores[no.tipo] ?? cores.funcao;
}

/** Pessoas do nó que podem ser mexidas (encarregado só muda no cadastro da equipe). */
function refsDe(no: NoOrganograma): PessoaRef[] {
  return no.pessoas.filter((p) => p.matricula && p.papel !== 'encarregado')
    .map((p) => ({ cracha: p.matricula, nome: p.nome, de: p.papel === 'membro' ? (p.equipe_id ?? null) : null }));
}

function lerArrasto(e: React.DragEvent): PessoaRef[] {
  try { return JSON.parse(e.dataTransfer.getData(TIPO_DND) || '[]') as PessoaRef[]; } catch { return []; }
}

function Caixa({ no, abertos, alternar, pessoas, alternarPessoas, cores, corSetor, edicao }: PropsRamo) {
  const aberto = abertos.has(no.id);
  const [incluindo, setIncluindo] = useState<'' | 'pessoa' | 'funcao'>('');
  const [sobre, setSobre] = useState(false);
  const verPessoas = pessoas.has(no.id);
  const temFilhos = no.filhos.length > 0;
  const temPessoas = no.pessoas.length > 0 && !temFilhos;
  const alvoEquipe = edicao && no.tipo === 'equipe' && no.ref ? no.ref : null;
  const alvoSemEquipe = edicao && no.tipo === 'setor' && no.titulo === 'Sem equipe';
  const recebe = !!(alvoEquipe || alvoSemEquipe);
  const refs = edicao && temPessoas ? refsDe(no) : [];
  const deEquipe = refs.length > 0 && refs.every((r) => r.de != null);
  const todasMarcadas = refs.length > 0 && refs.every((r) => edicao!.selecionadas.has(chavePessoa(r)));
  const colNomes = verPessoas && temPessoas ? colunasDeNomes(no.pessoas.length) : 1;
  return (
    <div className={cn(styles.card, verPessoas && styles.aberta, sobre && 'ring-2 ring-m-accent')} data-tipo={no.tipo}
      style={{ '--cor': corDaCaixa(no, cores, corSetor), ...(colNomes > 1 ? { width: `${14 * colNomes}rem` } : {}) } as React.CSSProperties}
      draggable={refs.length > 0 || undefined}
      onDragStart={refs.length ? (e) => { e.dataTransfer.setData(TIPO_DND, JSON.stringify(refs)); e.dataTransfer.effectAllowed = 'move'; } : undefined}
      onDragOver={recebe ? (e) => { if (e.dataTransfer.types.includes(TIPO_DND)) { e.preventDefault(); setSobre(true); } } : undefined}
      onDragLeave={recebe ? () => setSobre(false) : undefined}
      onDrop={recebe ? (e) => { e.preventDefault(); setSobre(false); const it = lerArrasto(e); if (it.length) edicao!.mover(it, alvoEquipe).catch(() => undefined); } : undefined}>
      {temPessoas ? (
        <button type="button" className={styles.folha} aria-expanded={verPessoas} onClick={() => alternarPessoas(no.id)}>
          <Cartao no={no} />
        </button>
      ) : <Cartao no={no} />}
      {edicao && no.tipo === 'equipe' && no.ref && (
        <div data-nao-imprimir className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-m-stroke-subtle pt-1 text-left text-[11px]">
          <label className="inline-flex items-center gap-1 text-m-text-secondary" title="Selecionar a equipe para definir responsável ou supervisor">
            <input type="checkbox" checked={edicao.equipesSel.has(no.ref)} onChange={() => edicao.alternarEquipe(no.ref!)} /> equipe
          </label>
          <button type="button" className="font-semibold text-m-accent" onClick={() => setIncluindo(incluindo === 'pessoa' ? '' : 'pessoa')}>+ pessoa</button>
          <button type="button" className="font-semibold text-m-accent" onClick={() => setIncluindo(incluindo === 'funcao' ? '' : 'funcao')}>+ função</button>
          {incluindo && <CardIncluir equipeId={no.ref} equipe={no.titulo} modo={incluindo} onModo={setIncluindo} edicao={edicao} onFechar={() => setIncluindo('')} />}
        </div>
      )}
      {edicao && refs.length > 0 && (
        <div data-nao-imprimir className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-m-stroke-subtle pt-1 text-left text-[11px]">
          <label className="inline-flex items-center gap-1 text-m-text-secondary"><input type="checkbox" checked={todasMarcadas} onChange={() => edicao.alternar(refs, !todasMarcadas)} /> todas</label>
          <select aria-label={`${deEquipe ? 'Migrar' : 'Pôr'} a função ${no.titulo}`} value="" className="max-w-[190px] rounded-[6px] border border-m-stroke bg-m-surface-field px-1 py-0.5"
            onChange={(e) => { if (e.target.value) edicao.mover(refs, Number(e.target.value)).catch(() => undefined); }}>
            <option value="">{deEquipe ? 'migrar função para…' : 'pôr na equipe…'}</option>
            {edicao.equipes.filter((x) => !refs.every((r) => r.de === x.id)).map((x) => <option key={x.id} value={x.id}>{rotuloEquipe(x)}</option>)}
          </select>
          {deEquipe && <button type="button" className="font-semibold text-m-danger" onClick={() => edicao.mover(refs, null).catch(() => undefined)}>tirar função</button>}
        </div>
      )}
      {verPessoas && temPessoas && (
        <ul className={styles.pessoas} style={colNomes > 1 ? { columnCount: colNomes, columnGap: '1rem' } : undefined}>
          {no.pessoas.map((p) => {
            const ref = edicao && p.matricula && p.papel !== 'encarregado' ? { cracha: p.matricula, nome: p.nome, de: p.papel === 'membro' ? (p.equipe_id ?? null) : null } : null;
            const marcada = !!ref && edicao!.selecionadas.has(chavePessoa(ref));
            return (
              <li key={`${p.matricula}-${p.nome}`} className={cn('break-inside-avoid border-t border-m-stroke-subtle py-1 text-[11px] text-m-text-secondary', ref && 'cursor-grab', marcada && 'bg-m-accent-subtle')}
                draggable={!!ref || undefined}
                onDragStart={ref ? (e) => {
                  e.stopPropagation();
                  const sel = [...edicao!.selecionadas.values()];
                  const itens = marcada && sel.length ? sel : [ref];
                  e.dataTransfer.setData(TIPO_DND, JSON.stringify(itens)); e.dataTransfer.effectAllowed = 'move';
                } : undefined}>
                <span className="flex items-start gap-1.5">
                  {ref && <input type="checkbox" aria-label={`Selecionar ${p.nome}`} className="mt-0.5" checked={marcada} onChange={() => edicao!.alternar([ref], !marcada)} />}
                  <span className="min-w-0">
                    <span className="block font-medium text-m-text-primary [overflow-wrap:anywhere]">{p.nome}</span>
                    <span className="block">{[p.matricula, p.turno, p.papel === 'encarregado' && 'encarregado'].filter(Boolean).join(' · ')}</span>
                  </span>
                </span>
                {ref && <AcoesPessoa ref_={ref} edicao={edicao!} />}
              </li>
            );
          })}
        </ul>
      )}
      {temFilhos && (
        <button type="button" data-ramo className={styles.alternar} aria-expanded={aberto} onClick={() => alternar(no.id)}
          aria-label={`${aberto ? 'Recolher' : 'Abrir'} ${no.titulo}`} title={aberto ? 'Recolher' : `Abrir ${no.filhos.length} item(ns)`}>
          {aberto ? '−' : `+${no.filhos.length}`}
        </button>
      )}
    </div>
  );
}

/**
 * Card por cima da tela (fora da área com zoom do organograma) para incluir pessoas ou uma função na equipe — a busca
 * e a lista aparecem inteiras, sem ficar atrás das outras caixas.
 */
function CardIncluir({ equipeId, equipe, modo, onModo, edicao, onFechar }: {
  equipeId: number; equipe: string; modo: 'pessoa' | 'funcao'; onModo: (m: 'pessoa' | 'funcao') => void; edicao: EdicaoOrganograma; onFechar: () => void;
}) {
  const [incluidos, setIncluidos] = useState<string[]>([]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-[10vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Incluir em ${equipe}`} className="flex w-[560px] max-w-full flex-col gap-3 rounded-m-lg border border-m-stroke bg-m-surface-raised p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Incluir na equipe</p>
            <h3 className="text-[16px] font-semibold text-m-text-primary">{equipe}</h3>
          </div>
          <button type="button" aria-label="Fechar" onClick={onFechar} className="rounded-full p-1.5 text-m-text-muted hover:bg-m-surface-hover"><X size={18} /></button>
        </div>
        <div className="inline-flex w-fit items-center gap-1 rounded-full border border-m-stroke p-0.5" role="group" aria-label="O que incluir">
          {([['pessoa', 'Pessoa'], ['funcao', 'Função inteira']] as const).map(([m, r]) => (
            <button key={m} type="button" aria-pressed={modo === m} onClick={() => onModo(m)}
              className={cn('h-8 rounded-full px-3 text-[12.5px] font-semibold', modo === m ? 'bg-m-accent text-white' : 'text-m-text-secondary hover:bg-m-surface-hover')}>{r}</button>
          ))}
        </div>
        {modo === 'pessoa' ? (
          <>
            <BuscaEfetivo rotulo="Buscar no efetivo (nome, matrícula, crachá ou função)" pessoas={edicao.efetivo} manterAberto
              onEscolher={(x) => {
                edicao.mover([{ cracha: x.cracha || x.matricula || '', nome: x.nome, de: x.equipe_id ?? null }], equipeId)
                  .then(() => setIncluidos((l) => [x.nome, ...l])).catch(() => undefined);
              }} />
            <p className="text-[12px] text-m-text-muted">Quem já está em outra equipe é movido para esta. Pode incluir várias pessoas seguidas.</p>
            {incluidos.length > 0 && (
              <div className="rounded-m-md border border-m-stroke-subtle p-2 text-[12.5px]">
                <span className="font-semibold text-m-text-primary">Incluídos agora:</span>
                <ul className="mt-1 flex flex-wrap gap-1.5">{incluidos.map((n, i) => <li key={`${n}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-m-accent-subtle px-2 py-0.5 text-m-accent"><UserPlus size={12} />{n}</li>)}</ul>
              </div>
            )}
          </>
        ) : <IncluirFuncao equipeId={equipeId} edicao={edicao} onFechar={onFechar} />}
        <div className="flex justify-end"><button type="button" onClick={onFechar} className="h-9 rounded-full border border-m-stroke px-4 text-[13px] font-semibold text-m-text-primary hover:bg-m-surface-hover">Concluir</button></div>
      </div>
    </div>,
    document.body,
  );
}

/** "+ função": escolhe a função e marca quem entra (sem equipe vem marcado; quem está em outra equipe é migrado). */
function IncluirFuncao({ equipeId, edicao, onFechar }: { equipeId: number; edicao: EdicaoOrganograma; onFechar: () => void }) {
  const [funcao, setFuncao] = useState('');
  const funcoes = useMemo(() => [...new Set(edicao.efetivo.filter((c) => !['DESMOBILIZADO', 'DESISTENCIA'].includes(c.situacao)).map((c) => c.funcao).filter(Boolean) as string[])].sort(), [edicao.efetivo]);
  const gente = edicao.efetivo.filter((c) => c.funcao === funcao && !['DESMOBILIZADO', 'DESISTENCIA'].includes(c.situacao) && c.equipe_id !== equipeId && !c.encarregado_de);
  const [marc, setMarc] = useState<Set<number>>(new Set());
  useEffect(() => { setMarc(new Set(gente.filter((c) => !c.equipe_id).map((c) => c.id))); }, [funcao]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="w-full text-[13px]">
      <select aria-label="Função a incluir" value={funcao} onChange={(e) => setFuncao(e.target.value)} className="w-full rounded-[6px] border border-m-stroke bg-m-surface-field px-1 py-1">
        <option value="">— escolha a função —</option>{funcoes.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      {funcao && (
        <ul className="mt-2 max-h-[45vh] overflow-auto rounded-m-md border border-m-stroke-subtle p-1">
          {gente.map((c) => (
            <li key={c.id}><label className="flex items-center gap-1.5 py-0.5">
              <input type="checkbox" checked={marc.has(c.id)} onChange={() => setMarc((m) => { const n = new Set(m); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} />
              <span className="truncate"><b className="text-m-text-primary">{c.nome}</b> <span className="text-m-text-muted">{c.equipe ?? 'sem equipe'}</span></span>
            </label></li>
          ))}
          {!gente.length && <li className="text-m-text-muted">Ninguém com essa função fora desta equipe.</li>}
        </ul>
      )}
      <div className="mt-1 flex gap-2">
        <button type="button" disabled={!marc.size} className="rounded-full bg-m-accent px-3 py-1 font-semibold text-white disabled:opacity-50"
          onClick={() => { edicao.mover(gente.filter((c) => marc.has(c.id)).map((c) => ({ cracha: c.cracha || c.matricula || '', nome: c.nome, de: c.equipe_id ?? null })), equipeId).catch(() => undefined); onFechar(); }}>
          Incluir {marc.size || ''}
        </button>
        <button type="button" className="font-semibold text-m-text-muted underline" onClick={onFechar}>fechar</button>
      </div>
    </div>
  );
}

const ROTULO_TIPO: Record<NoOrganograma['tipo'], string> = { obra: 'Obra', setor: 'Setor', responsavel: 'Responsável', supervisor: 'Supervisor', disciplina: 'Disciplina', frente: 'Frente', area: 'Área', equipe: 'Equipe', funcao: 'Função' };

function Cartao({ no }: { no: NoOrganograma }) {
  const tipo = RAMOS_ESPECIAIS.has(no.titulo) && no.tipo === 'setor' ? 'Grupo' : ROTULO_TIPO[no.tipo];
  const detalhe = no.detalhe && !['Setor', 'Função', 'Obra', 'Disciplina', 'Responsável', 'Supervisor'].includes(no.detalhe) ? no.detalhe : '';
  const dica = [no.titulo, detalhe, `${no.qtd} ${no.qtd === 1 ? 'pessoa' : 'pessoas'}`].filter(Boolean).join('\n');
  return (
    <div className={styles.cartao} title={dica}>
      <div className="flex items-center justify-between gap-2">
        <span className={styles.tipo}>{tipo}</span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-m-text-secondary">{no.qtd} {no.qtd === 1 ? 'pessoa' : 'pessoas'}</span>
      </div>
      <p className={styles.titulo}>{no.titulo}</p>
      {detalhe && <p className={styles.detalhe}>{detalhe}</p>}
    </div>
  );
}

/** Mover / tirar (membro de equipe) ou pôr numa equipe (sem equipe, em mobilização). */
function AcoesPessoa({ ref_, edicao }: { ref_: PessoaRef; edicao: EdicaoOrganograma }) {
  const destinos = edicao.equipes.filter((e) => e.id !== ref_.de);
  return (
    <span data-nao-imprimir className="mt-0.5 flex items-center gap-2 pl-5">
      <select aria-label={`${ref_.de ? 'Mover' : 'Pôr na equipe'} ${ref_.nome}`} value="" className="w-full rounded-[6px] border border-m-stroke bg-m-surface-field px-1 py-0.5 text-[11px]"
        onChange={(e) => { if (e.target.value) edicao.mover([ref_], Number(e.target.value)).catch(() => undefined); }}>
        <option value="">{ref_.de ? 'mover para…' : 'pôr na equipe…'}</option>
        {destinos.map((e) => <option key={e.id} value={e.id}>{rotuloEquipe(e)}</option>)}
      </select>
      {ref_.de != null && <button type="button" className="font-semibold text-m-danger" onClick={() => edicao.mover([ref_], null).catch(() => undefined)}>Tirar</button>}
    </span>
  );
}
