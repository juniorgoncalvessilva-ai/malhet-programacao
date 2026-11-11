'use client';

import { ChevronsDownUp, ChevronsUpDown, Maximize2, Minimize2, Minus, Plus, ScanSearch } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { NoOrganograma } from '@/lib/api/types';
import styles from './OrganogramaArvore.module.css';

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 1.6;
const LISTA_LONGA = 12;
const NIVEIS = [
  { n: 1, rotulo: 'Setores' },
  { n: 2, rotulo: 'Supervisores' },
  { n: 3, rotulo: 'Equipes' },
  { n: 99, rotulo: 'Funções' },
];

/** ids dos nós que, até a profundidade `nivel`, ficam abertos (mostram os filhos). */
function abertosAte(raiz: NoOrganograma, nivel: number): Set<string> {
  const out = new Set<string>();
  const ir = (no: NoOrganograma, prof: number) => {
    if (prof >= nivel || !no.filhos.length) return;
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
export function OrganogramaArvore({ raiz, ariaLabel, expandirTudo = false }: { raiz: NoOrganograma; ariaLabel: string; expandirTudo?: boolean }) {
  const [nivel, setNivel] = useState(expandirTudo ? 99 : 2);
  const [abertos, setAbertos] = useState<Set<string>>(() => abertosAte(raiz, expandirTudo ? 99 : 2));
  const [pessoas, setPessoas] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [cheia, setCheia] = useState(false);
  const janela = useRef<HTMLDivElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const arrasto = useRef<{ x: number; y: number; l: number; t: number } | null>(null);

  // nova árvore (busca) → reabre no nível escolhido; com busca, abre tudo para mostrar os achados
  useEffect(() => { const n = expandirTudo ? 99 : nivel; setAbertos(abertosAte(raiz, n)); }, [raiz, expandirTudo]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const escolherNivel = (n: number) => { setNivel(n); setAbertos(abertosAte(raiz, n)); };
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
        <button type="button" className={botao} onClick={() => escolherNivel(99)}><ChevronsUpDown size={14} /> Expandir tudo</button>
        <button type="button" className={botao} onClick={() => escolherNivel(1)}><ChevronsDownUp size={14} /> Recolher tudo</button>
        <span className="text-[12px] text-m-text-muted">{visiveis} caixas visíveis</span>
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
          if ((e.target as HTMLElement).closest('button')) return;
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
          <div ref={conteudo} className={styles.conteudo} style={{ transform: `scale(${zoom})` }}>
            <ul className={styles.arvore} aria-label={ariaLabel}>
              <Ramo no={raiz} abertos={abertos} alternar={alternar} pessoas={pessoas} alternarPessoas={alternarPessoas} />
            </ul>
          </div>
        </div>
      </div>
      <p className="text-[11.5px] text-m-text-muted">Arraste para navegar · Ctrl + rolagem para zoom · +/− abre ou recolhe um ramo · clique numa função para ver as pessoas{cheia ? ' · Esc sai da tela cheia' : ''}.</p>
    </div>
  );
}

type PropsRamo = { no: NoOrganograma; abertos: Set<string>; alternar: (id: string) => void; pessoas: Set<string>; alternarPessoas: (id: string) => void };

function Ramo(props: PropsRamo) {
  const { no, abertos } = props;
  const aberto = abertos.has(no.id);
  const temFilhos = no.filhos.length > 0;
  // filhos que são todos folhas (funções) empilham na vertical: a árvore fica estreita
  const empilhar = temFilhos && no.filhos.every((f) => !f.filhos.length);
  return (
    <li className={styles.no}>
      <Caixa {...props} />
      {temFilhos && aberto && (
        <>
          <span className={styles.haste} aria-hidden="true" />
          {empilhar
            ? <ul className={styles.coluna}>{no.filhos.map((f) => <li key={f.id}><Caixa {...props} no={f} /></li>)}</ul>
            : <ul>{no.filhos.map((f) => <Ramo key={f.id} {...props} no={f} />)}</ul>}
        </>
      )}
    </li>
  );
}

function Caixa({ no, abertos, alternar, pessoas, alternarPessoas }: PropsRamo) {
  const aberto = abertos.has(no.id);
  const verPessoas = pessoas.has(no.id);
  const temFilhos = no.filhos.length > 0;
  const temPessoas = no.pessoas.length > 0 && !temFilhos;
  return (
    <div className={cn(styles.card, verPessoas && styles.aberta)} data-tipo={no.tipo}>
      {temPessoas ? (
        <button type="button" className={styles.folha} aria-expanded={verPessoas} onClick={() => alternarPessoas(no.id)}>
          <Cartao no={no} />
        </button>
      ) : <Cartao no={no} />}
      {verPessoas && temPessoas && (
        <ul className={styles.pessoas}>
          {no.pessoas.map((p) => (
            <li key={`${p.matricula}-${p.nome}`} className="border-t border-m-stroke-subtle py-1 text-[11px] text-m-text-secondary">
              <span className="block truncate font-medium text-m-text-primary">{p.nome}</span>
              <span className="block truncate">{[p.matricula, p.turno].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
      {temFilhos && (
        <button type="button" className={styles.alternar} aria-expanded={aberto} onClick={() => alternar(no.id)}
          aria-label={`${aberto ? 'Recolher' : 'Abrir'} ${no.titulo}`} title={aberto ? 'Recolher' : `Abrir ${no.filhos.length} item(ns)`}>
          {aberto ? '−' : `+${no.filhos.length}`}
        </button>
      )}
    </div>
  );
}

function Cartao({ no }: { no: NoOrganograma }) {
  return (
    <>
      <p className="truncate text-[10px] uppercase tracking-[0.3px] text-m-text-muted">{no.detalhe}</p>
      <p className="truncate text-[12px] font-semibold leading-4 text-m-text-primary" title={no.titulo}>{no.titulo}</p>
      <p className="text-[10.5px] tabular-nums text-m-text-secondary">{no.qtd} {no.qtd === 1 ? 'pessoa' : 'pessoas'}</p>
    </>
  );
}
