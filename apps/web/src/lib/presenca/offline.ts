'use client';

/**
 * Guarda da presença no próprio celular (IndexedDB) — spec 063. A base (pessoas, códigos, rostos) e as leituras ficam
 * no aparelho; as leituras sobem em sequência quando houver internet (`sincronizar`). Nada aqui depende de rede.
 */

export interface PessoaBase {
  id: number; nome: string; matricula: string | null; cracha: string | null; funcao: string | null; situacao: string;
  equipe_id: number | null; codigos: string[]; nfc: string | null; face: number[] | null;
}
export interface BasePresenca {
  gerado_em: string; distancia_max: number; pessoas: PessoaBase[];
  equipes: { id: number; nome: string; encarregado: string | null }[];
}
export type Meio = 'nfc' | 'qr' | 'codigo' | 'facial' | 'manual';
export interface LeituraLocal {
  id_local: string; obra_id: number; colaborador_id: number; nome: string; data: string; hora: string; meio: Meio;
  enviada: boolean; erro?: string | null;
}

const NOME = 'malhet-campo';
let conexao: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  conexao ??= new Promise((ok, falha) => {
    const r = indexedDB.open(NOME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('leituras')) {
        const st = db.createObjectStore('leituras', { keyPath: 'id_local' });
        st.createIndex('obra_data', ['obra_id', 'data']);
      }
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { conexao = null; falha(r.error); };
  });
  return conexao;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, falha) => { r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error); });
}

async function loja(nome: 'kv' | 'leituras', modo: IDBTransactionMode) {
  return (await abrir()).transaction(nome, modo).objectStore(nome);
}

export async function lerBase(obraId: number): Promise<BasePresenca | null> {
  return ((await req((await loja('kv', 'readonly')).get(`base:${obraId}`))) as BasePresenca | undefined) ?? null;
}
export async function salvarBase(obraId: number, b: BasePresenca): Promise<void> {
  await req((await loja('kv', 'readwrite')).put(b, `base:${obraId}`));
}

export async function guardarLeitura(l: LeituraLocal): Promise<void> {
  await req((await loja('leituras', 'readwrite')).put(l));
}

export async function leiturasDoDia(obraId: number, data: string): Promise<LeituraLocal[]> {
  const st = await loja('leituras', 'readonly');
  const lista = (await req(st.index('obra_data').getAll(IDBKeyRange.only([obraId, data])))) as LeituraLocal[];
  return lista.sort((a, b) => b.hora.localeCompare(a.hora));
}

export async function pendentes(obraId: number): Promise<LeituraLocal[]> {
  const st = await loja('leituras', 'readonly');
  return ((await req(st.getAll())) as LeituraLocal[]).filter((l) => l.obra_id === obraId && !l.enviada && !l.erro);
}

async function marcar(ids: string[], mudar: Partial<LeituraLocal>): Promise<void> {
  if (!ids.length) return;
  const st = await loja('leituras', 'readwrite');
  for (const id of ids) {
    const l = (await req(st.get(id))) as LeituraLocal | undefined;
    if (l) await req(st.put({ ...l, ...mudar }));
  }
}

/** Apaga do aparelho as leituras já enviadas com mais de 7 dias. */
export async function limparAntigas(): Promise<void> {
  const limite = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const st = await loja('leituras', 'readwrite');
  for (const l of (await req(st.getAll())) as LeituraLocal[]) if (l.enviada && l.data < limite) await req(st.delete(l.id_local));
}

export const idLocal = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const normalizarCodigo = (v: string) => v.replace(/[\s:\-]/g, '').toUpperCase();

type Post = <T>(p: string, b: unknown) => Promise<T>;
let enviando: Promise<number> | null = null;

/** Sobe a fila da obra em lotes de 200 (uma vez por vez). Devolve quantas foram confirmadas. Sem rede, fica para depois. */
export function sincronizar(post: Post, obraId: number): Promise<number> {
  enviando ??= (async () => {
    let ok = 0;
    try {
      for (;;) {
        const fila = (await pendentes(obraId)).slice(0, 200);
        if (!fila.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) break;
        const r = await post<{ aceitas: number; repetidas: number; erros: { id_local: string; erro: string }[] }>('/presenca/leituras', {
          leituras: fila.map(({ id_local, colaborador_id, data, hora, meio }) => ({ id_local, colaborador_id, data, hora, meio, dispositivo: navigator.userAgent.slice(0, 120) })),
        });
        const comErro = new Map(r.erros.map((e) => [e.id_local, e.erro]));
        await marcar(fila.filter((l) => !comErro.has(l.id_local)).map((l) => l.id_local), { enviada: true });
        for (const [id, erro] of comErro) await marcar([id], { erro });
        ok += r.aceitas + r.repetidas;
        if (fila.length < 200) break;
      }
    } catch { /* sem rede ou sessão: tenta de novo depois */ }
    return ok;
  })().finally(() => { enviando = null; });
  return enviando;
}
