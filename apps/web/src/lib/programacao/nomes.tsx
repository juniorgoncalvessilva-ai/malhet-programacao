'use client';

import { useSyncExternalStore } from 'react';
import type { LinhaVisao } from '@/lib/api/types';

/**
 * Texto da atividade na programação (spec 046): "Reduzido + complemento" (nome simplificado do item da PQ + texto do
 * CWP, padrão) ou "Descritivo da PQ" (descrição completa + complemento). A escolha vale para todas as telas e fica
 * lembrada no navegador.
 */
export type ModoNomes = 'reduzido' | 'pq';
const CHAVE = 'malhet.programacao.nomes';
const ouvintes = new Set<() => void>();

function ler(): ModoNomes {
  try { return localStorage.getItem(CHAVE) === 'pq' ? 'pq' : 'reduzido'; } catch { return 'reduzido'; }
}

export function useModoNomes(): [ModoNomes, (m: ModoNomes) => void] {
  const modo = useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f); }, ler, () => 'reduzido' as ModoNomes);
  const trocar = (m: ModoNomes) => {
    try { localStorage.setItem(CHAVE, m); } catch { /* sem armazenamento: vale só nesta tela */ }
    ouvintes.forEach((f) => f());
  };
  return [modo, trocar];
}

type ComTextos = Pick<LinhaVisao, 'descricao'> & Partial<Pick<LinhaVisao, 'descricao_reduzida' | 'descricao_completa'>>;
/** Emissões antigas não têm os dois textos: fica o que foi emitido. */
export const nomeLinha = (ln: ComTextos, modo: ModoNomes) =>
  (modo === 'pq' ? ln.descricao_completa : ln.descricao_reduzida) || ln.descricao;

/** Botão de escolha dos nomes (o "Reduzido + complemento" é o ativo por padrão). */
export function BotaoNomes({ className = '' }: { className?: string }) {
  const [modo, trocar] = useModoNomes();
  const op = (m: ModoNomes, r: string, dica: string) => (
    <button key={m} type="button" aria-pressed={modo === m} title={dica} onClick={() => trocar(m)}
      className={`h-8 rounded-full px-3 text-[12.5px] font-semibold ${modo === m ? 'bg-m-accent text-white' : 'text-m-text-secondary hover:bg-m-surface-hover'}`}>{r}</button>
  );
  return (
    <div role="group" aria-label="Nomes das atividades" className={`inline-flex items-center gap-1 rounded-full border border-m-stroke bg-m-surface-raised p-0.5 print:hidden ${className}`}>
      {op('reduzido', 'Reduzido + complemento', 'Nome simplificado do item da PQ + complemento (CWP)')}
      {op('pq', 'Descritivo da PQ', 'Descrição completa do item da PQ + complemento')}
    </div>
  );
}

/** Linhas da área agrupadas por CWP (na ordem em que cada CWP aparece); `cwp` vem só na primeira linha do grupo. */
export function porCwp<T extends Pick<LinhaVisao, 'cwp'>>(linhas: T[]): { ln: T; cwp: NonNullable<T['cwp']> | null; inicio: boolean }[] {
  const chave = (ln: T) => (ln.cwp ? `${ln.cwp.id ?? ''}|${ln.cwp.texto}` : '');
  const ordem: string[] = [];
  const grupos = new Map<string, T[]>();
  for (const ln of linhas) {
    const k = chave(ln);
    if (!grupos.has(k)) { grupos.set(k, []); ordem.push(k); }
    grupos.get(k)!.push(ln);
  }
  // sem CWP primeiro (linhas soltas da área), depois cada CWP
  ordem.sort((a, b) => (a === '' ? -1 : b === '' ? 1 : 0));
  return ordem.flatMap((k) => grupos.get(k)!.map((ln, i) => ({ ln, cwp: (ln.cwp ?? null) as NonNullable<T['cwp']> | null, inicio: i === 0 && k !== '' })));
}
