'use client';

import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { buscarTelas, type GrupoMenu } from './menu';

/**
 * Ir para qualquer tela pelo nome (spec 125): Ctrl+K (⌘K no Mac) ou o botão "Buscar" no topo. Procura no título, nas
 * palavras de cada tela ("take-off", "PPC", "RDO", "ASO"…) e no grupo; só aparecem as telas que a pessoa pode ver.
 */
export function BuscaTelas({ grupos }: { grupos: GrupoMenu[] }) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAberto((v) => !v); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} aria-label="Buscar tela (Ctrl+K)" data-tour="busca"
        className="flex h-9 items-center gap-2 rounded-full border border-m-stroke-subtle px-3 text-[13px] text-m-text-muted hover:bg-m-surface-hover">
        <Search size={15} aria-hidden="true" />
        <span className="hidden sm:inline">Buscar</span>
        <kbd className="hidden rounded-[6px] border border-m-stroke-subtle px-1.5 text-[11px] font-medium md:inline">Ctrl K</kbd>
      </button>
      {aberto && createPortal(<Janela grupos={grupos} onFechar={() => setAberto(false)} />, document.body)}
    </>
  );
}

function Janela({ grupos, onFechar }: { grupos: GrupoMenu[]; onFechar: () => void }) {
  const router = useRouter();
  const [termo, setTermo] = useState('');
  const [sel, setSel] = useState(0);
  const lista = useRef<HTMLUListElement>(null);
  const achados = useMemo(() => buscarTelas(grupos, termo), [grupos, termo]);
  useEffect(() => setSel(0), [termo]);
  useEffect(() => { lista.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const ir = (url: string) => { onFechar(); router.push(url); };
  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onFechar();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, achados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && achados[sel]) { e.preventDefault(); ir(achados[sel].item.url); }
  };
  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center bg-black/40 px-4 pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Buscar tela" className="w-full max-w-[560px] overflow-hidden rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised shadow-xl">
        <label className="flex items-center gap-3 border-b border-m-stroke-subtle px-4">
          <Search size={18} className="text-m-text-muted" aria-hidden="true" />
          <input autoFocus value={termo} onChange={(e) => setTermo(e.target.value)} onKeyDown={tecla} aria-label="Nome da tela"
            role="combobox" aria-expanded="true" aria-controls="busca-telas" aria-activedescendant={achados[sel] ? `busca-${sel}` : undefined}
            placeholder="Ir para… (ex.: take-off, PPC, presença, ASO)" className="h-14 flex-1 border-0 bg-transparent p-0 text-[15px] shadow-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none" />
          <kbd className="rounded-[6px] border border-m-stroke-subtle px-1.5 text-[11px] text-m-text-muted">Esc</kbd>
        </label>
        <ul id="busca-telas" ref={lista} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {!achados.length && <li className="px-3 py-6 text-center text-[13px] text-m-text-muted">Nenhuma tela com esse nome.</li>}
          {achados.map(({ item, grupo }, i) => {
            const Icone = item.icone;
            return (
              <li key={item.url} id={`busca-${i}`} role="option" aria-selected={i === sel}
                onMouseEnter={() => setSel(i)} onClick={() => ir(item.url)}
                className={cn('flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px]', i === sel ? 'bg-m-surface-active text-m-accent' : 'text-m-text-secondary')}>
                <Icone size={18} strokeWidth={1.75} aria-hidden="true" />
                <span className="flex-1 font-medium">{item.titulo}</span>
                <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.4px] text-m-text-muted">
                  <span className="h-1.5 w-1.5 rounded-[2px]" style={{ background: grupo.cor }} />{grupo.etapa}
                </span>
                {i === sel && <CornerDownLeft size={14} className="text-m-text-muted" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
