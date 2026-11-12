/** Filtro da programação por encarregado (spec 047): chave = crachá, senão o nome; linhas sem equipe/encarregado = "sem". */
type Linha = { cracha?: string | null; encarregado?: string | null; equipe?: string | null };
type Area<L> = { linhas: L[] };
type Local<L, A extends Area<L>> = { areas: A[] };

export const SEM_ENCARREGADO = '__sem__';
export const chaveEncarregado = (ln: Linha) => ln.cracha || ln.encarregado || SEM_ENCARREGADO;

export function encarregadosDe<L extends Linha, A extends Area<L>>(locais: Local<L, A>[]) {
  const m = new Map<string, { chave: string; nome: string; linhas: number }>();
  for (const loc of locais) for (const a of loc.areas) for (const ln of a.linhas) {
    const k = chaveEncarregado(ln);
    const nome = k === SEM_ENCARREGADO ? 'Sem encarregado' : `${ln.encarregado ?? ln.equipe ?? k}${ln.cracha ? ` (${ln.cracha})` : ''}`;
    const x = m.get(k) ?? { chave: k, nome, linhas: 0 };
    x.linhas += 1;
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => (a.chave === SEM_ENCARREGADO ? 1 : b.chave === SEM_ENCARREGADO ? -1 : a.nome.localeCompare(b.nome, 'pt-BR')));
}

/** Só as linhas do encarregado escolhido (vazio = todas); áreas e locais sem linha somem. */
export function filtrarEncarregado<L extends Linha, A extends Area<L>, T extends Local<L, A>>(locais: T[], chave: string): T[] {
  if (!chave) return locais;
  return locais
    .map((loc) => ({ ...loc, areas: loc.areas.map((a) => ({ ...a, linhas: a.linhas.filter((ln) => chaveEncarregado(ln) === chave) })).filter((a) => a.linhas.length) }))
    .filter((loc) => loc.areas.length);
}

/**
 * Encarregado como nível da programação (spec 054): Encarregado → (frente · área) → linhas, as linhas de cada
 * encarregado na ordem da sequência (nº seq) para ver o sequenciamento dele no período. A área vira faixa a cada troca.
 */
type LinhaSeq = Linha & { id: number; seq?: number };
type AreaG = { id: number; codigo: string; descricao: string; linhas: LinhaSeq[] };
type LocalG = { id: number; codigo: string; descricao: string; areas: AreaG[] };
export function agruparPorEncarregado<T extends LocalG>(locais: T[]): T[] {
  const itens = locais.flatMap((l) => l.areas.flatMap((a) => a.linhas.map((ln) => ({ l, a, ln }))));
  const grupos = new Map<string, typeof itens>();
  for (const x of itens) { const k = chaveEncarregado(x.ln); grupos.set(k, [...(grupos.get(k) ?? []), x]); }
  const chaves = [...grupos.keys()].sort((a, b) => (a === SEM_ENCARREGADO ? 1 : b === SEM_ENCARREGADO ? -1 : 0));
  let idArea = 1_000_000;
  return chaves.map((k, i) => {
    const xs = grupos.get(k)!.sort((p, q) => (p.ln.seq ?? 0) - (q.ln.seq ?? 0));
    const primeira = xs[0].ln;
    const areas: AreaG[] = [];
    for (const x of xs) {
      const ultima = areas[areas.length - 1];
      const rot = `${x.l.codigo} · ${x.a.codigo}`;
      if (ultima && ultima.codigo === rot) ultima.linhas.push(x.ln);
      else areas.push({ ...x.a, id: idArea++, codigo: rot, descricao: x.a.descricao, linhas: [x.ln] });
    }
    return {
      ...xs[0].l, id: -(i + 1),
      codigo: k === SEM_ENCARREGADO ? '—' : (primeira.cracha || '—'),
      descricao: k === SEM_ENCARREGADO ? 'Sem encarregado' : `Encarregado ${primeira.encarregado ?? primeira.equipe ?? k}`,
      areas,
    } as T;
  });
}
