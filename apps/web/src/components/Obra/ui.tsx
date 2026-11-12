'use client';

/**
 * Componentes da obra no design system Malhet / CorpMind (tokens em src/css/malhet.css).
 * Cards sem sombra (a camada vem da superfície), raio 20; controles e pílulas em pill; rótulos 11px CAIXA ALTA.
 */
import { cn } from '@/lib/utils';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

type Tom = 'neutro' | 'acento' | 'sucesso' | 'atencao' | 'perigo' | 'info';

const TOM: Record<Tom, { bg: string; fg: string }> = {
  neutro: { bg: 'var(--m-surface-hover)', fg: 'var(--m-text-secondary)' },
  acento: { bg: 'var(--m-accent-subtle)', fg: 'var(--m-accent)' },
  sucesso: { bg: 'var(--m-success-subtle)', fg: 'var(--m-success)' },
  atencao: { bg: 'var(--m-warning-subtle)', fg: 'var(--m-warning)' },
  perigo: { bg: 'var(--m-danger-subtle)', fg: 'var(--m-danger)' },
  info: { bg: 'var(--m-info-subtle)', fg: 'var(--m-info)' },
};

/** Cabeçalho de tela: eyebrow colorido + título + ações à direita (sem texto descritivo, para ganhar espaço). */
export function Cabecalho({ eyebrow, cor = 'var(--m-proc-planejar)', titulo, acoes, children }: {
  eyebrow: string; cor?: string; titulo: string; acoes?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-[780px] flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase leading-4 tracking-[0.48px]" style={{ color: cor }}>
            <span className="h-2 w-2 rounded-[2px]" style={{ background: cor }} />
            {eyebrow}
          </div>
          <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.2px] sm:text-[30px] sm:leading-9">{titulo}</h1>
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
      {children}
    </div>
  );
}

export function Painel({ titulo, subtitulo, acoes, children, className }: {
  titulo: ReactNode; subtitulo?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-4 rounded-m-xl border border-m-stroke-subtle bg-m-surface-raised p-5 sm:p-6', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold leading-[22px]">{titulo}</h2>
          {subtitulo && <p className="text-[13px] leading-[18px] text-m-text-muted">{subtitulo}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center justify-end gap-2">{acoes}</div>}
      </header>
      {children}
    </section>
  );
}

const rotuloCls = 'flex flex-col gap-1.5 text-[11px] font-semibold uppercase leading-4 tracking-[0.48px] text-m-text-muted';
const campoCls =
  'h-10 w-full rounded-m-md border border-m-stroke bg-m-surface-field px-3 text-sm normal-case tracking-normal font-normal text-m-text-primary outline-none transition-colors placeholder:text-m-text-muted focus:border-m-accent';

export function Campo({ rotulo, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { rotulo?: string }) {
  if (!rotulo) return <input {...p} className={cn(campoCls, className)} />;
  return (
    <label className={cn(rotuloCls, className)}>
      {rotulo}
      <input {...p} className={campoCls} />
    </label>
  );
}

export function Selecao({ rotulo, className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string }) {
  return (
    <label className={cn(rotuloCls, className)}>
      {rotulo}
      <select {...p} className={campoCls}>{children}</select>
    </label>
  );
}

export function Botao({ variante = 'primario', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'fantasma' | 'perigo' | 'excluir';
}) {
  const v = {
    primario: 'bg-m-accent-strong text-m-on-accent hover:opacity-90',
    secundario: 'border border-m-stroke bg-m-surface-raised text-m-text-primary hover:bg-m-surface-hover',
    fantasma: 'text-m-accent hover:bg-m-accent-subtle',
    perigo: 'border border-m-stroke text-m-danger hover:bg-m-danger-subtle',
    excluir: 'bg-m-danger text-white hover:opacity-90',
  }[variante];
  return (
    <button
      {...p}
      className={cn('inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition disabled:opacity-50', v, className)}
    />
  );
}

/** Pílula de status com ponto. */
export function Pilula({ tom = 'neutro', ponto = true, children }: { tom?: Tom; ponto?: boolean; children: ReactNode }) {
  const t = TOM[tom];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold leading-4" style={{ background: t.bg, color: t.fg }}>
      {ponto && <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.fg }} />}
      {children}
    </span>
  );
}

/** Chip de seleção (abas em pill). */
export function Chip({ ativo, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ativo?: boolean }) {
  return (
    <button
      type="button"
      {...p}
      className={cn('inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-[13px]',
        ativo ? 'bg-m-accent-strong font-semibold text-m-on-accent' : 'border border-m-stroke text-m-text-secondary hover:bg-m-surface-hover')}
    >
      {children}
    </button>
  );
}

export function Tabela({ cabecalho, children, vazio, direita = [] }: {
  cabecalho: string[]; children: ReactNode; vazio?: boolean | string; direita?: number[];
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {cabecalho.map((h, i) => (
              <th key={h + i} className={cn('whitespace-nowrap border-b border-m-stroke-subtle px-3 pb-2.5 text-[11px] font-semibold uppercase leading-4 tracking-[0.4px] text-m-text-muted', direita.includes(i) ? 'text-right' : 'text-left')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {vazio && <p className="py-8 text-center text-[13px] text-m-text-muted">{typeof vazio === 'string' ? vazio : 'Nada por aqui ainda.'}</p>}
    </div>
  );
}

export const td = 'border-b border-m-row px-3 py-3 align-middle text-[13px] leading-[18px] text-m-text-secondary';
export const tdNum = `${td} whitespace-nowrap text-right`;

export function Erro({ erro }: { erro: unknown }) {
  if (!erro) return null;
  return <p className="rounded-m-md bg-m-danger-subtle px-3 py-2 text-[13px] text-m-danger">{(erro as Error).message}</p>;
}

export function Indicador({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; tom?: Tom }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-m-carimbo border border-m-stroke-subtle bg-m-surface-raised px-4 py-3">
      <span className="text-[11px] font-semibold uppercase leading-4 tracking-[0.48px] text-m-text-muted">{rotulo}</span>
      <span className="text-[22px] font-semibold leading-7 tracking-[-0.3px]" style={tom ? { color: TOM[tom].fg } : undefined}>{valor}</span>
      {detalhe && <span className="truncate text-xs text-m-text-tertiary">{detalhe}</span>}
    </div>
  );
}

export function UploadForm({ campos, onEnviar, rotulo, pendente, children, accept = '.xlsx,.xlsm' }: {
  campos: { nome: string; rotulo: string }[]; accept?: string;
  onEnviar: (fd: FormData) => void; rotulo: string; pendente?: boolean; children?: ReactNode;
}) {
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => { e.preventDefault(); onEnviar(new FormData(e.currentTarget)); }}
    >
      {campos.map((c) => (
        <label key={c.nome} className={rotuloCls}>
          {c.rotulo}
          <input
            type="file" name={c.nome} accept={accept}
            className="h-10 rounded-m-md border border-dashed border-m-stroke-strong bg-m-surface-field px-2 py-2 text-[13px] font-normal normal-case tracking-normal text-m-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-m-accent-subtle file:px-3 file:py-1 file:text-xs file:font-semibold file:text-m-accent"
          />
        </label>
      ))}
      {children}
      <Botao type="submit" disabled={pendente}>{pendente ? 'Enviando…' : rotulo}</Botao>
    </form>
  );
}

export const fmt = (n: number | null | undefined, casas = 2) =>
  n === null || n === undefined ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: casas });
export const dataBR = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
