'use client';

import { useSyncExternalStore } from 'react';

/** Preferência de tela lembrada no navegador (ex.: bloco minimizado, detalhe escondido). Vale em todas as abas abertas. */
const ouvintes = new Set<() => void>();

export function usePreferencia(chave: string, padrao: boolean): [boolean, (v: boolean) => void] {
  const ler = () => {
    try { const v = localStorage.getItem(chave); return v === null ? padrao : v === '1'; } catch { return padrao; }
  };
  const valor = useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f); }, ler, () => padrao);
  const trocar = (v: boolean) => {
    try { localStorage.setItem(chave, v ? '1' : '0'); } catch { /* sem armazenamento: vale só agora */ }
    ouvintes.forEach((f) => f());
  };
  return [valor, trocar];
}
