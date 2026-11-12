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
