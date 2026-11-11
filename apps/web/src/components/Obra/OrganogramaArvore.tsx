'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { NoOrganograma } from '@/lib/api/types';
import styles from './OrganogramaArvore.module.css';

/** Árvore horizontal do organograma (modelo do Malhet): clique numa função para ver as pessoas. */
export function OrganogramaArvore({ raiz, ariaLabel }: { raiz: NoOrganograma; ariaLabel: string }) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const alternar = (id: string) => setAbertas((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div className={styles.moldura}>
      <ul className={styles.arvore} aria-label={ariaLabel}>
        <Ramo no={raiz} abertas={abertas} alternar={alternar} />
      </ul>
    </div>
  );
}

function Ramo({ no, abertas, alternar }: { no: NoOrganograma; abertas: Set<string>; alternar: (id: string) => void }) {
  const aberto = abertas.has(no.id);
  const temPessoas = no.pessoas.length > 0;
  return (
    <li className={styles.no}>
      <div className={cn(styles.card, aberto && styles.aberta)} data-tipo={no.tipo}>
        {temPessoas ? (
          <button type="button" className={styles.folha} aria-expanded={aberto} onClick={() => alternar(no.id)}>
            <Cartao no={no} />
          </button>
        ) : <Cartao no={no} />}
        {aberto && temPessoas && (
          <ul className={styles.pessoas}>
            {no.pessoas.map((p) => (
              <li key={`${p.matricula}-${p.nome}`} className="border-t border-m-stroke-subtle py-1 text-xs text-m-text-secondary">
                <span className="block truncate font-medium text-m-text-primary">{p.nome}</span>
                <span className="block truncate">{[p.matricula, p.turno].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {no.filhos.length > 0 && (
        <>
          <span className={styles.haste} aria-hidden="true" />
          <ul>{no.filhos.map((f) => <Ramo key={f.id} no={f} abertas={abertas} alternar={alternar} />)}</ul>
        </>
      )}
    </li>
  );
}

function Cartao({ no }: { no: NoOrganograma }) {
  return (
    <>
      <p className="text-[11px] text-m-text-muted">{no.detalhe}</p>
      <p className="truncate text-[13px] font-semibold text-m-text-primary" title={no.titulo}>{no.titulo}</p>
      <p className="text-[11px] tabular-nums text-m-text-secondary">{no.qtd} {no.qtd === 1 ? 'pessoa' : 'pessoas'}</p>
    </>
  );
}
