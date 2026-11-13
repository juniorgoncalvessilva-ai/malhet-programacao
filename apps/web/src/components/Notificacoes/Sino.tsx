'use client';

import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ListaNotificacoes } from '@/components/Notificacoes/Lista';
import { Link } from '@/i18n/navigation';
import { useContagemNotificacoes } from '@/lib/notificacoes';

/** Sino do cabeçalho do web (spec 076): contagem de não lidas e as últimas, com atalho para a central. */
export function Sino() {
  const n = useContagemNotificacoes();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={n ? `Notificações: ${n} não lidas` : 'Notificações'} aria-expanded={aberto} onClick={() => setAberto(!aberto)}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-m-stroke-subtle text-m-text-secondary hover:bg-m-surface-hover">
        <Bell size={17} />
        {n > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-m-danger px-1 text-[10px] font-bold text-white">{n > 99 ? '99+' : n}</span>}
      </button>
      {aberto && (
        <div className="absolute right-0 top-11 z-50 w-[380px] max-w-[calc(100vw-24px)] rounded-m-lg border border-m-stroke-subtle bg-m-surface-raised p-3 shadow-m-md">
          <div className="mb-1 flex items-center justify-between"><b className="text-[15px]">Notificações</b>
            <Link href="/app/notificacoes" onClick={() => setAberto(false)} className="text-[13px] font-semibold text-m-accent">ver todas</Link></div>
          <div className="max-h-[60vh] overflow-y-auto"><ListaNotificacoes limite={8} onAbrir={() => setAberto(false)} /></div>
        </div>
      )}
    </div>
  );
}
