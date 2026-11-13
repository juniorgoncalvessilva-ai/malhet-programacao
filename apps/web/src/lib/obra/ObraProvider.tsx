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
const guardar = <T,>(k: string, v: T): T => { try { localStorage.setItem(`malhet.cache.${k}`, JSON.stringify(v)); } catch { /* sem storage */ } return v; };
const guardado = <T,>(k: string): T | undefined => { try { const v = localStorage.getItem(`malhet.cache.${k}`); return v ? (JSON.parse(v) as T) : undefined; } catch { return undefined; } };

export function ObraProvider({ children }: { children: React.ReactNode }) {
  const { getToken, usuario } = useSessao();
  const qc = useQueryClient();
  // guardadas no aparelho: sem internet o app de campo abre com a última lista (spec 063)
  const eu = useQuery({
    queryKey: ['eu', usuario?.id],
    queryFn: async () => guardar(`eu:${usuario?.id}`, await apiFetch<{ superadmin: boolean }>('/eu', getToken)),
    enabled: !!usuario,
    initialData: () => guardado<{ superadmin: boolean }>(`eu:${usuario?.id}`), initialDataUpdatedAt: 0,
  });
  const lista = useQuery({
    queryKey: ['obras-minhas', usuario?.id],
    queryFn: async () => guardar(`obras:${usuario?.id}`, await apiFetch<MinhaObra[]>('/obras/minhas', getToken)),
    enabled: !!usuario,
    initialData: () => guardado<MinhaObra[]>(`obras:${usuario?.id}`), initialDataUpdatedAt: 0,
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

  useCorDaObra(obra?.cor ?? null);
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

/** Cor do cliente (marca da obra) no lugar do verde Malhet: redefine os tokens de acento, no claro e no escuro. */
function useCorDaObra(cor: string | null) {
  useEffect(() => {
    const id = 'malhet-cor-obra';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!cor || !/^#[0-9A-Fa-f]{6}$/.test(cor)) { el?.remove(); return; }
    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
    el.textContent = `:root{--m-accent:${cor};--m-accent-strong:${cor};--m-accent-hover:color-mix(in srgb,${cor} 80%,black);--m-accent-subtle:color-mix(in srgb,${cor} 12%,white)}`
      + `.dark{--m-accent:color-mix(in srgb,${cor} 55%,white);--m-accent-strong:color-mix(in srgb,${cor} 85%,black);--m-accent-hover:color-mix(in srgb,${cor} 40%,white);--m-accent-subtle:color-mix(in srgb,${cor} 25%,#141517)}`;
  }, [cor]);
}
