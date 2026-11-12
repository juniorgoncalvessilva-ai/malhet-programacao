/**
 * Visibilidade do organograma (spec 052): mostrar só os ramos de certos setores, responsáveis, supervisores,
 * disciplinas, frentes, áreas, equipes, encarregados ou funções, e esconder níveis (os filhos sobem para o nível de
 * cima; com "funções" escondidas, as pessoas aparecem direto na equipe). As contagens são refeitas sobre o que ficou.
 */
import type { NoOrganograma } from '@/lib/api/types';

type Categoria = 'setor' | 'responsavel' | 'supervisor' | 'disciplina' | 'frente' | 'area' | 'equipe' | 'encarregado' | 'funcao';
type Ocultavel = 'responsavel' | 'supervisor' | 'disciplina' | 'frente' | 'area' | 'funcao';
export interface FiltroOrganograma { por: Record<Categoria, string[]>; ocultar: Ocultavel[]; semRamosSoltos: boolean }
export const FILTRO_VAZIO: FiltroOrganograma = {
  por: { setor: [], responsavel: [], supervisor: [], disciplina: [], frente: [], area: [], equipe: [], encarregado: [], funcao: [] },
  ocultar: [], semRamosSoltos: false,
};
const SOLTOS = new Set(['Sem equipe', 'Em mobilização']);
const encarregadoDe = (n: NoOrganograma) => {
  const m = /^Enc\.:\s*(.+)$/.exec(n.detalhe ?? '');
  return m && m[1] !== '—' ? m[1] : null;
};

export function opcoesDoOrganograma(raiz: NoOrganograma | null): Record<Categoria, string[]> {
  const out: Record<Categoria, Set<string>> = {
    setor: new Set(), responsavel: new Set(), supervisor: new Set(), disciplina: new Set(), frente: new Set(), area: new Set(),
    equipe: new Set(), encarregado: new Set(), funcao: new Set(),
  };
  const ir = (n: NoOrganograma) => {
    if (n.tipo !== 'obra' && n.tipo in out) out[n.tipo as Categoria].add(n.titulo);
    if (n.tipo === 'equipe') { const e = encarregadoDe(n); if (e) out.encarregado.add(e); }
    n.filhos.forEach(ir);
  };
  if (raiz) ir(raiz);
  const ord = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, ord(v)])) as Record<Categoria, string[]>;
}

function contar(n: NoOrganograma): number {
  n.qtd = n.pessoas.length + n.filhos.reduce((s, f) => s + contar(f), 0);
  return n.qtd;
}

/** Junta irmãos iguais (mesmo tipo e título) que ficaram lado a lado depois de esconder um nível. */
function juntarIguais(filhos: NoOrganograma[]): NoOrganograma[] {
  const m = new Map<string, NoOrganograma>();
  for (const f of filhos) {
    const k = `${f.tipo}|${f.titulo}`;
    const x = m.get(k);
    if (!x) m.set(k, { ...f, filhos: [...f.filhos], pessoas: [...f.pessoas] });
    else { x.filhos = juntarIguais([...x.filhos, ...f.filhos]); x.pessoas = [...x.pessoas, ...f.pessoas]; x.ref = x.ref ?? f.ref; }
  }
  return [...m.values()];
}

export function filtrarOrganograma(raiz: NoOrganograma, f: FiltroOrganograma): NoOrganograma | null {
  const ativas = (Object.keys(f.por) as Categoria[]).filter((k) => f.por[k].length);
  const sel = Object.fromEntries(ativas.map((k) => [k, new Set(f.por[k])])) as Record<Categoria, Set<string>>;

  // 1) filtros: o ramo fica se, no caminho até a folha, cada categoria escolhida casou
  const podar = (n: NoOrganograma, ok: Set<Categoria>): NoOrganograma | null => {
    if (f.semRamosSoltos && n.tipo === 'setor' && SOLTOS.has(n.titulo)) return null;
    const agora = new Set(ok);
    for (const c of ativas) {
      const titulo = c === 'encarregado' ? (n.tipo === 'equipe' ? encarregadoDe(n) : undefined) : (n.tipo === c ? n.titulo : undefined);
      if (titulo === undefined) continue;
      if (titulo === null || !sel[c].has(titulo)) return null;
      agora.add(c);
    }
    if (!n.filhos.length) return ativas.every((c) => agora.has(c)) ? { ...n } : null;
    const filhos = n.filhos.map((x) => podar(x, agora)).filter((x): x is NoOrganograma => !!x);
    if (!filhos.length && n.tipo !== 'obra') return null;
    return { ...n, filhos };
  };
  let r = ativas.length || f.semRamosSoltos ? podar(raiz, new Set()) : raiz;
  if (!r) return null;

  // 2) níveis escondidos: os filhos sobem (funções escondidas: as pessoas ficam na equipe)
  const esconder = new Set(f.ocultar);
  if (esconder.size) {
    const achatar = (n: NoOrganograma): NoOrganograma => {
      let filhos: NoOrganograma[] = [];
      let pessoas = [...n.pessoas];
      for (const x of n.filhos.map(achatar)) {
        if (x.tipo === 'funcao' && esconder.has('funcao') && n.tipo === 'equipe') pessoas = [...pessoas, ...x.pessoas];
        else if (esconder.has(x.tipo as Ocultavel) && x.tipo !== 'funcao') filhos = [...filhos, ...x.filhos];
        else filhos.push(x);
      }
      return { ...n, filhos: juntarIguais(filhos), pessoas };
    };
    r = achatar(r);
  }
  contar(r);
  return r;
}
