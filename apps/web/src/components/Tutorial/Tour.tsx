'use client';

import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Passeio guiado (spec 097): escurece a tela, recorta o elemento marcado com `data-tour="<alvo>"` e mostra um cartão ao
 * lado com o que ele faz. Passo sem alvo (ou com o alvo fora da tela) vira cartão centralizado. Teclado: → / Enter
 * avança, ← volta, Esc pula. Sem biblioteca.
 */
export interface Passo { alvo?: string; titulo: string; texto: ReactNode }

const MARGEM = 8, LARGURA = 360, ESPACO = 14;

function achar(alvo?: string): HTMLElement | null {
  if (!alvo) return null;
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${alvo}"]`));
  return els.find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) ?? null;
}

type Caixa = { top: number; left: number; width: number; height: number };

function posicionar(r: Caixa | null, card: { w: number; h: number }): { top: number; left: number } {
  const vw = window.innerWidth, vh = window.innerHeight;
  const centro = { top: Math.max(16, (vh - card.h) / 2), left: Math.max(16, (vw - card.w) / 2) };
  if (!r) return centro;
  const cabe = (top: number, left: number) => top >= 8 && left >= 8 && top + card.h <= vh - 8 && left + card.w <= vw - 8;
  const meioY = Math.min(Math.max(8, r.top + r.height / 2 - card.h / 2), vh - card.h - 8);
  const meioX = Math.min(Math.max(8, r.left + r.width / 2 - card.w / 2), vw - card.w - 8);
  const opcoes: [number, number][] = [
    [meioY, r.left + r.width + ESPACO], // à direita (itens do menu lateral)
    [r.top + r.height + ESPACO, meioX], // embaixo
    [r.top - card.h - ESPACO, meioX], // em cima (barra do celular)
    [meioY, r.left - card.w - ESPACO], // à esquerda
  ];
  const ok = opcoes.find(([t, l]) => cabe(t, l));
  return ok ? { top: ok[0], left: ok[1] } : { top: Math.min(vh - card.h - 12, Math.max(12, r.top + r.height + ESPACO)), left: meioX };
}

export function Tour({ passos, aberto, onFim }: { passos: Passo[]; aberto: boolean; onFim: (concluido: boolean) => void }) {
  const [i, setI] = useState(0);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999 });
  const cardRef = useRef<HTMLDivElement>(null);
  const passo = passos[i];
  useEffect(() => { if (aberto) setI(0); }, [aberto]);

  const medir = useCallback(() => {
    if (!passo) return;
    const el = achar(passo.alvo);
    let r: Caixa | null = null;
    if (el) {
      const b = el.getBoundingClientRect();
      r = { top: b.top - MARGEM, left: b.left - MARGEM, width: b.width + MARGEM * 2, height: b.height + MARGEM * 2 };
    }
    setCaixa(r);
    const c = cardRef.current;
    setPos(posicionar(r, { w: c?.offsetWidth ?? LARGURA, h: c?.offsetHeight ?? 220 }));
  }, [passo]);

  useLayoutEffect(() => {
    if (!aberto || !passo) return;
    const el = achar(passo.alvo);
    if (el) {
      const b = el.getBoundingClientRect();
      if (b.top < 0 || b.bottom > window.innerHeight) el.scrollIntoView({ block: 'center' });
    }
    medir();
    const t = setTimeout(medir, 60); // depois do cartão ter o tamanho final
    cardRef.current?.focus();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => { clearTimeout(t); window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); };
  }, [aberto, passo, medir]);

  const ultimo = i === passos.length - 1;
  const avancar = useCallback(() => (ultimo ? onFim(true) : setI((x) => x + 1)), [ultimo, onFim]);
  const voltar = useCallback(() => setI((x) => Math.max(0, x - 1)), []);
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFim(false);
      else if (e.key === 'ArrowRight') avancar();
      else if (e.key === 'ArrowLeft') voltar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberto, avancar, voltar, onFim]);

  if (!aberto || !passo) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] font-[Figtree,system-ui,sans-serif] print:hidden" aria-hidden={false}>
      {/* fundo escuro com o recorte no alvo (a sombra enorme escurece o resto) */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      <div aria-hidden="true" className="pointer-events-none absolute rounded-[14px] transition-all duration-300 ease-out"
        style={caixa
          ? { top: caixa.top, left: caixa.left, width: caixa.width, height: caixa.height, boxShadow: '0 0 0 9999px rgba(7,9,17,.58)', outline: '2px solid var(--m-accent)', outlineOffset: 0 }
          : { top: '50%', left: '50%', width: 0, height: 0, boxShadow: '0 0 0 9999px rgba(7,9,17,.58)' }} />
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="tour-titulo" aria-describedby="tour-texto" tabIndex={-1}
        className="absolute flex w-[min(360px,calc(100vw-24px))] flex-col gap-3 rounded-m-xl border border-m-stroke-subtle bg-m-surface-raised p-5 text-m-text-primary shadow-m-md outline-none transition-[top,left] duration-300 ease-out"
        style={{ top: pos.top, left: pos.left }}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.48px] text-m-text-muted">Passo {i + 1} de {passos.length}</span>
          <button type="button" onClick={() => onFim(false)} className="-mr-2 inline-flex h-8 items-center gap-1 rounded-full px-2 text-[12.5px] text-m-text-muted hover:bg-m-surface-hover">
            Pular <X size={14} aria-hidden="true" />
          </button>
        </div>
        <h2 id="tour-titulo" className="text-[19px] font-semibold leading-6 tracking-[-0.2px]">{passo.titulo}</h2>
        <div id="tour-texto" className="text-[14px] leading-[21px] text-m-text-secondary">{passo.texto}</div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="flex gap-1" aria-hidden="true">
            {passos.map((_, k) => <span key={k} className="h-1.5 rounded-full transition-all" style={{ width: k === i ? 18 : 6, background: k <= i ? 'var(--m-accent)' : 'var(--m-stroke)' }} />)}
          </span>
          <span className="flex gap-2">
            {i > 0 && (
              <button type="button" onClick={voltar} aria-label="Passo anterior" className="grid h-10 w-10 place-items-center rounded-full border border-m-stroke text-m-text-secondary hover:bg-m-surface-hover">
                <ArrowLeft size={16} />
              </button>
            )}
            <button type="button" onClick={avancar} className="inline-flex h-10 items-center gap-2 rounded-full bg-m-accent-strong px-4 text-[13.5px] font-semibold text-m-on-accent">
              {ultimo ? 'Começar a usar' : i === 0 ? 'Mostrar' : 'Próximo'} {!ultimo && <ArrowRight size={15} aria-hidden="true" />}
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
