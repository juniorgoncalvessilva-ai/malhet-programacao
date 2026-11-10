'use client';

import { cn } from '@/lib/utils';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export function Painel({ titulo, acoes, children, className }: { titulo: string; acoes?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke px-4 py-3 dark:border-dark-3 sm:px-6">
        <h2 className="font-medium text-dark dark:text-white">{titulo}</h2>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </header>
      <div className={cn('p-4 sm:p-6', className)}>{children}</div>
    </section>
  );
}

const campoCls =
  'w-full rounded-[7px] border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white';

export function Campo({ rotulo, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { rotulo: string }) {
  return (
    <label className={cn('flex flex-col gap-1 text-xs font-medium text-dark-5 dark:text-dark-6', className)}>
      {rotulo}
      <input {...p} className={campoCls} />
    </label>
  );
}

export function Selecao({ rotulo, className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string }) {
  return (
    <label className={cn('flex flex-col gap-1 text-xs font-medium text-dark-5 dark:text-dark-6', className)}>
      {rotulo}
      <select {...p} className={campoCls}>
        {children}
      </select>
    </label>
  );
}

export function Botao({ variante = 'primario', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'perigo' }) {
  const v = {
    primario: 'bg-primary text-white hover:bg-opacity-90',
    secundario: 'border border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2',
    perigo: 'border border-red text-red hover:bg-red/10',
  }[variante];
  return <button {...p} className={cn('rounded-[7px] px-4 py-2 text-sm font-medium transition disabled:opacity-50', v, className)} />;
}

export function Etiqueta({ cor = 'cinza', children }: { cor?: 'cinza' | 'verde' | 'azul' | 'amarelo' | 'vermelho'; children: ReactNode }) {
  const c = {
    cinza: 'bg-gray-2 text-dark-5 dark:bg-dark-2 dark:text-dark-6',
    verde: 'bg-green-light-6 text-green-dark',
    azul: 'bg-blue-light-5 text-blue-dark',
    amarelo: 'bg-yellow-light-4 text-yellow-dark-2',
    vermelho: 'bg-red-light-6 text-red-dark',
  }[cor];
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', c)}>{children}</span>;
}

export function Tabela({ cabecalho, children, vazio }: { cabecalho: string[]; children: ReactNode; vazio?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-stroke text-xs uppercase text-dark-5 dark:border-dark-3 dark:text-dark-6">
            {cabecalho.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke dark:divide-dark-3">{children}</tbody>
      </table>
      {vazio && <p className="py-6 text-center text-sm text-dark-5">Nada por aqui ainda.</p>}
    </div>
  );
}

export const td = 'px-3 py-2 align-top text-dark dark:text-white';

export function Erro({ erro }: { erro: unknown }) {
  if (!erro) return null;
  return <p className="rounded-md bg-red-light-6 px-3 py-2 text-sm text-red-dark">{(erro as Error).message}</p>;
}

export function UploadForm({ campos, onEnviar, rotulo, pendente, children }: {
  campos: { nome: string; rotulo: string; multiplo?: boolean }[];
  onEnviar: (fd: FormData) => void; rotulo: string; pendente?: boolean; children?: ReactNode;
}) {
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar(new FormData(e.currentTarget));
      }}
    >
      {campos.map((c) => (
        <label key={c.nome} className="flex flex-col gap-1 text-xs font-medium text-dark-5">
          {c.rotulo}
          <input type="file" name={c.nome} accept=".xlsx,.xlsm" className="text-sm" />
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
