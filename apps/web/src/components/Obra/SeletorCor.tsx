'use client';

import { cn } from '@/lib/utils';

/** Paleta pensada para leitura em fundo claro e escuro. */
export const PALETA = ['#1F3A3A', '#0F766E', '#15803D', '#65A30D', '#CA8A04', '#EA580C', '#DC2626', '#DB2777', '#9333EA', '#4F46E5', '#2563EB', '#0891B2', '#64748B', '#78716C'];

export function SeletorCor({ rotulo, valor, onChange, padrao, disabled }: {
  rotulo: string; valor: string | null; onChange: (c: string | null) => void; padrao?: string; disabled?: boolean;
}) {
  const atual = (valor ?? padrao ?? '').toUpperCase();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">{rotulo}</span>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={rotulo}>
        {PALETA.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={atual === c} aria-label={c} title={c} disabled={disabled}
            onClick={() => onChange(c)} style={{ background: c }}
            className={cn('h-6 w-6 rounded-full border-2 transition-transform disabled:opacity-50', atual === c ? 'scale-110 border-m-text-primary' : 'border-transparent hover:scale-110')} />
        ))}
        <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-m-stroke" title="Outra cor"
          style={{ background: 'conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)' }}>
          <input type="color" aria-label={`${rotulo}: outra cor`} disabled={disabled} value={atual || '#0F766E'} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        {valor && padrao !== undefined && !disabled && <button type="button" className="ml-1 text-[12px] font-medium text-m-text-muted underline" onClick={() => onChange(null)}>padrão</button>}
      </div>
    </div>
  );
}
