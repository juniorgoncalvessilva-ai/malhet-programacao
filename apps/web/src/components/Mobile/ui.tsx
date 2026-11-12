'use client';

import { ChevronLeft } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { Link } from '@/i18n/navigation';

/** Cabeçalho das telas internas do campo: voltar (44 px), título e subtítulo. */
export function TopoM({ titulo, sub, voltar, acao }: { titulo: string; sub?: ReactNode; voltar?: string; acao?: ReactNode }) {
  return (
    <header className="-mx-2 flex items-center gap-2">
      {voltar && <Link href={voltar} aria-label="Voltar" className="grid h-11 w-11 shrink-0 place-items-center"><ChevronLeft size={22} /></Link>}
      <div className={`flex min-w-0 flex-1 flex-col ${voltar ? '' : 'px-2'}`}>
        <h1 className={voltar ? 'text-[17px] font-semibold leading-[22px]' : 'text-[24px] font-semibold leading-[30px]'}>{titulo}</h1>
        {sub && <span className="truncate text-[12px] leading-4 text-m-text-muted">{sub}</span>}
      </div>
      {acao}
    </header>
  );
}

export const cartaoM = 'flex flex-col gap-3 rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-[18px]';
const campoCls = 'w-full rounded-[14px] border border-m-stroke bg-m-surface-field px-3.5 text-[15px] text-m-text-primary outline-none focus:border-m-accent';

export function CampoM({ rotulo, ...p }: InputHTMLAttributes<HTMLInputElement> & { rotulo: string }) {
  return <label className="flex flex-col gap-1.5 text-[13px] font-medium text-m-text-secondary">{rotulo}<input {...p} className={`${campoCls} h-12`} /></label>;
}

export function TextoM({ rotulo, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo: string }) {
  return <label className="flex flex-col gap-1.5 text-[13px] font-medium text-m-text-secondary">{rotulo}<textarea rows={3} {...p} className={`${campoCls} py-3`} /></label>;
}

/** Escolha única em chips (40 px de altura, quebram linha). */
export function ChipsM<T extends string | number>({ rotulo, opcoes, valor, onChange }: {
  rotulo: string; opcoes: { valor: T; rotulo: string }[]; valor: T | null; onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-m-text-secondary">{rotulo}</span>
      <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button key={String(o.valor)} type="button" role="radio" aria-checked={valor === o.valor} onClick={() => onChange(valor === o.valor ? null : o.valor)}
            className={`min-h-[40px] rounded-full px-3.5 text-left text-[14px] ${valor === o.valor ? 'bg-m-accent-strong font-semibold text-m-on-accent' : 'border border-m-stroke'}`}>{o.rotulo}</button>
        ))}
      </div>
    </div>
  );
}

/** Rodapé fixo de ação (acima da barra de navegação). */
export function RodapeM({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-20" aria-hidden="true" />
      <div className="fixed bottom-[76px] left-1/2 z-10 flex w-full max-w-[480px] -translate-x-1/2 gap-2.5 border-t border-m-stroke-subtle bg-m-surface-raised px-4 py-3">{children}</div>
    </>
  );
}
export const botaoPrimarioM = 'h-[52px] flex-[2] rounded-full bg-m-accent-strong text-[15px] font-semibold text-m-on-accent disabled:opacity-50';
export const botaoSecundarioM = 'h-[52px] flex-1 rounded-full border border-m-stroke text-[15px] font-medium';
