'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

/** Folha que sobe de baixo, por cima da tela (portal do encarregado e do apontador). */
export function Folha({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 font-[Figtree,system-ui,sans-serif]" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="portal-lider flex max-h-[90dvh] w-full max-w-[520px] flex-col gap-3 overflow-y-auto rounded-t-[24px] bg-m-surface-raised p-4 pb-[max(env(safe-area-inset-bottom),16px)] text-m-text-primary">
        <div className="flex items-start gap-3">
          <h2 className="flex-1 text-[18px] font-semibold leading-6">{titulo}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full border border-m-stroke"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
