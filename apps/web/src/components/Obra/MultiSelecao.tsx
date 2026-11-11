'use client';

import { Paperclip, X } from 'lucide-react';

export interface OpcaoMulti { valor: string; rotulo: string; anexos?: { id: number; nome: string }[] }

/** Vários itens por campo (RAC, PTS, ART, ATA, PTO): chips + lista "adicionar". N/A vale sozinho. */
export function MultiSelecao({ rotulo, valor, opcoes, onChange, disabled, largura = 'w-[180px]', onBaixar, comNa = true }: {
  rotulo: string; valor: string[]; opcoes: OpcaoMulti[]; onChange: (v: string[]) => void; disabled?: boolean;
  largura?: string; onBaixar?: (anexoId: number, nome: string) => void; comNa?: boolean;
}) {
  const restantes = opcoes.filter((o) => !valor.includes(o.valor));
  const adicionar = (v: string) => {
    if (!v) return;
    if (v === 'N/A') onChange(['N/A']);
    else onChange([...valor.filter((x) => x !== 'N/A'), v]);
  };
  const porValor = new Map(opcoes.map((o) => [o.valor, o]));
  return (
    <div className={`flex ${largura} flex-col gap-1`}>
      {valor.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {valor.map((v) => {
            const o = porValor.get(v);
            return (
              <span key={v} className="inline-flex max-w-full items-center gap-1 rounded-full bg-m-accent-subtle px-2 py-0.5 text-[11.5px] font-medium text-m-accent">
                <span className="truncate" title={o?.rotulo ?? v}>{v}</span>
                {!!o?.anexos?.length && onBaixar && o.anexos.map((a) => (
                  <button key={a.id} type="button" title={`Baixar ${a.nome}`} aria-label={`Baixar ${a.nome}`} onClick={() => onBaixar(a.id, a.nome)} className="shrink-0 hover:opacity-70"><Paperclip size={11} /></button>
                ))}
                {!disabled && <button type="button" aria-label={`Tirar ${v} de ${rotulo}`} onClick={() => onChange(valor.filter((x) => x !== v))} className="shrink-0 hover:opacity-70"><X size={11} /></button>}
              </span>
            );
          })}
        </div>
      )}
      {!disabled && (
        <select aria-label={`Adicionar ${rotulo}`} value="" onChange={(e) => adicionar(e.target.value)}
          className={`h-8 w-full rounded-[8px] border bg-m-surface-field px-1.5 text-[12.5px] text-m-text-secondary outline-none focus:border-m-accent ${valor.length ? 'border-m-stroke' : 'border-m-warning'}`}>
          <option value="">{valor.length ? '+ adicionar…' : 'Escolha…'}</option>
          {comNa && !valor.includes('N/A') && <option value="N/A">N/A</option>}
          {restantes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}{o.anexos?.length ? ' · com arquivo' : ''}</option>)}
        </select>
      )}
      {disabled && !valor.length && <span className="text-[12px] text-m-text-muted">—</span>}
    </div>
  );
}
