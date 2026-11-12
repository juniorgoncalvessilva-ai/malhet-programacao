'use client';

/** Obra corrente: lista as obras do usuário, lembra a escolhida e manda X-Obra-Id em todas as chamadas. */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useSessao } from '@/lib/auth/AuthProvider';
import type { MinhaObra, PapelObra } from '@/lib/api/types';

interface ObraCtx {
  obras: MinhaObra[];
  obra: MinhaObra | null;
  papel: PapelObra | null;
  superadmin: boolean;
  carregando: boolean;
  escolher: (id: number) => void;
  pode: (minimo: PapelObra) => boolean;
  /** Segurança, planejador e admin preenchem o SSMA. */
  editaSsma: boolean;
  /** Página liberada para a pessoa nesta obra (url do menu). Sem lista = todas as do papel; a programação vigente fica
   * sempre aberta e o admin nunca perde os acessos. */
  podeVer: (url: string) => boolean;
}

const NIVEL: Record<PapelObra, number> = { leitor: 0, seguranca: 0, encarregado: 1, planejador: 2, admin: 3 };
const CHAVE = 'malhet.obra';
const Ctx = createContext<ObraCtx | null>(null);

export function ObraProvider({ children }: { children: React.ReactNode }) {
  const { getToken, usuario } = useSessao();
  const qc = useQueryClient();
  const eu = useQuery({
    queryKey: ['eu', usuario?.id],
    queryFn: () => apiFetch<{ superadmin: boolean }>('/eu', getToken),
    enabled: !!usuario,
  });
  const lista = useQuery({
    queryKey: ['obras-minhas', usuario?.id],
    queryFn: () => apiFetch<MinhaObra[]>('/obras/minhas', getToken),
    enabled: !!usuario,
  });
  const [obraId, setObraId] = useState<number | null>(null);

  useEffect(() => {
    if (!lista.data) return;
    let salvo: number | null = null;
    try { salvo = Number(localStorage.getItem(CHAVE)) || null; } catch { /* sem storage */ }
    const valido = lista.data.find((o) => o.id === (obraId ?? salvo));
    setObraId(valido ? valido.id : lista.data[0]?.id ?? null);
  }, [lista.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolher = useCallback((id: number) => {
    setObraId(id);
    try { localStorage.setItem(CHAVE, String(id)); } catch { /* sem storage */ }
    // dados de outra obra não podem ficar no cache
    qc.removeQueries({ predicate: (q) => !['eu', 'obras-minhas', 'admin-obras', 'admin-usuarios'].includes(String(q.queryKey[0])) });
  }, [qc]);

  const obra = lista.data?.find((o) => o.id === obraId) ?? null;
  const valor = useMemo<ObraCtx>(() => ({
    obras: lista.data ?? [],
    obra,
    papel: obra?.papel ?? null,
    superadmin: !!eu.data?.superadmin,
    carregando: lista.isLoading || eu.isLoading,
    escolher,
    pode: (m) => !!obra && NIVEL[obra.papel] >= NIVEL[m],
    editaSsma: !!obra && ['seguranca', 'planejador', 'admin'].includes(obra.papel),
    podeVer: (url) => !!eu.data?.superadmin || !obra?.paginas?.length || url === '/app/vigente'
      || (obra.papel === 'admin' && url === '/app/acessos') || obra.paginas.includes(url),
  }), [lista.data, lista.isLoading, eu.data, eu.isLoading, obra, escolher]);

  // key: trocar de obra remonta as telas (nenhum estado/consulta da obra anterior sobrevive)
  return <Ctx.Provider value={valor}><Fragment key={obra?.id ?? 'sem-obra'}>{children}</Fragment></Ctx.Provider>;
}

export function useObra(): ObraCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useObra fora do ObraProvider');
  return c;
}

export function useObraOpcional(): ObraCtx | null {
  return useContext(Ctx);
}
