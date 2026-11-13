'use client';

import { ArrowDown, ArrowUp, Star } from 'lucide-react';
import { MAX_BARRA, MENU_MOBILE, type ItemMobile } from '@/components/Mobile/menu';
import type { MenuConfig } from '@/lib/perfil';

/**
 * Montar a barra do celular (spec 075): até 4 atalhos (na ordem) + 1 botão central em destaque. As outras telas ficam em
 * "Mais". `telas` = o que a pessoa (ou o perfil) pode ver.
 */
export function EditorMenu({ valor, onChange, telas }: { valor: MenuConfig; onChange: (m: MenuConfig) => void; telas: ItemMobile[] }) {
  const na = (u: string) => valor.barra.includes(u);
  const alternar = (u: string) => {
    if (na(u)) onChange({ ...valor, barra: valor.barra.filter((x) => x !== u) });
    else if (valor.barra.length < MAX_BARRA) onChange({ ...valor, barra: [...valor.barra, u], destaque: valor.destaque === u ? null : valor.destaque });
  };
  const mover = (u: string, d: -1 | 1) => {
    const i = valor.barra.indexOf(u); const j = i + d;
    if (j < 0 || j >= valor.barra.length) return;
    const b = [...valor.barra]; [b[i], b[j]] = [b[j], b[i]];
    onChange({ ...valor, barra: b });
  };
  const item = (u: string) => MENU_MOBILE.find((i) => i.url === u);
  const dest = valor.destaque ? item(valor.destaque) : null;
  const esq = dest ? valor.barra.slice(0, 2) : valor.barra; const dir = dest ? valor.barra.slice(2) : [];
  const Mini = ({ u }: { u: string }) => { const it = item(u); if (!it) return null; const I = it.icone; return <span className="flex min-w-0 flex-col items-center gap-0.5 text-[10px] text-m-text-muted"><I size={18} /><span className="max-w-full truncate">{it.curto ?? it.titulo}</span></span>; };
  return (
    <div className="flex flex-col gap-3">
      <div aria-label="Prévia da barra" className="grid items-end rounded-[16px] border border-m-stroke-subtle bg-m-surface-raised px-2 pb-2 pt-4"
        style={{ gridTemplateColumns: `repeat(${esq.length + dir.length + (dest ? 1 : 0) + 1}, minmax(0, 1fr))` }}>
        {esq.map((u) => <Mini key={u} u={u} />)}
        {dest && (() => { const I = dest.icone; return <span className="-mt-5 flex flex-col items-center gap-0.5 text-[10px] font-semibold text-m-accent"><span className="grid h-11 w-11 place-items-center rounded-full bg-m-accent-strong text-m-on-accent"><I size={22} /></span>{dest.curto ?? dest.titulo}</span>; })()}
        {dir.map((u) => <Mini key={u} u={u} />)}
        <span className="flex flex-col items-center gap-0.5 text-[10px] text-m-text-muted"><span className="text-[18px] leading-[18px]">⋯</span>Mais</span>
      </div>
      <span className="text-[12.5px] text-m-text-muted">Marque até {MAX_BARRA} atalhos ({valor.barra.length}/{MAX_BARRA}) e escolha o botão do centro (★). O resto fica em “Mais”.</span>
      <ul className="flex flex-col">
        {telas.map((t) => {
          const I = t.icone; const marcado = na(t.url); const estrela = valor.destaque === t.url;
          return (
            <li key={t.url} className="flex min-h-[52px] items-center gap-2 border-b border-m-stroke-subtle">
              <label className="flex min-w-0 flex-1 items-center gap-2.5">
                <input type="checkbox" checked={marcado} disabled={(!marcado && valor.barra.length >= MAX_BARRA) || estrela} onChange={() => alternar(t.url)} className="h-5 w-5" aria-label={`${t.titulo} na barra`} />
                <I size={19} className="shrink-0 text-m-accent" aria-hidden="true" />
                <span className="min-w-0"><span className="block truncate text-[14px]">{t.titulo}</span><span className="block truncate text-[11.5px] text-m-text-muted">{t.descricao}</span></span>
              </label>
              {marcado && <>
                <button type="button" aria-label={`Subir ${t.titulo}`} onClick={() => mover(t.url, -1)} className="grid h-9 w-9 place-items-center rounded-full border border-m-stroke"><ArrowUp size={15} /></button>
                <button type="button" aria-label={`Descer ${t.titulo}`} onClick={() => mover(t.url, 1)} className="grid h-9 w-9 place-items-center rounded-full border border-m-stroke"><ArrowDown size={15} /></button>
              </>}
              <button type="button" aria-pressed={estrela} aria-label={`${t.titulo} no centro`} onClick={() => onChange({ barra: valor.barra.filter((x) => x !== t.url), destaque: estrela ? null : t.url })}
                className={`grid h-9 w-9 place-items-center rounded-full ${estrela ? 'bg-m-accent-strong text-m-on-accent' : 'border border-m-stroke text-m-text-muted'}`}><Star size={15} /></button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
