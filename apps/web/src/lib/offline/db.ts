'use client';

/**
 * Banco do app de campo no próprio aparelho (IndexedDB `malhet-campo`): o que é feito sem internet fica aqui até subir.
 * - kv: bases e cópias das listas (pessoas, modelos, frentes…) para abrir as telas sem rede;
 * - leituras: presença (spec 063);
 * - fila: registros completos esperando internet — auditoria (spec 072), etilômetro (spec 073)…
 */
const NOME = 'malhet-campo';
const VERSAO = 2;
export type Loja = 'kv' | 'leituras' | 'fila';
let conexao: Promise<IDBDatabase> | null = null;

export function abrir(): Promise<IDBDatabase> {
  conexao ??= new Promise((ok, falha) => {
    const r = indexedDB.open(NOME, VERSAO);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('leituras')) {
        const st = db.createObjectStore('leituras', { keyPath: 'id_local' });
        st.createIndex('obra_data', ['obra_id', 'data']);
      }
      if (!db.objectStoreNames.contains('fila')) {
        const st = db.createObjectStore('fila', { keyPath: 'id_local' });
        st.createIndex('obra', 'obra_id');
      }
    };
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => { db.close(); conexao = null; }; // outra aba atualizou o banco
      ok(db);
    };
    r.onblocked = () => { /* outra aba com a versão antiga: abre quando ela fechar */ };
    r.onerror = () => { conexao = null; falha(r.error); };
  });
  return conexao;
}

export function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, falha) => { r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error); });
}

export async function loja(nome: Loja, modo: IDBTransactionMode) {
  return (await abrir()).transaction(nome, modo).objectStore(nome);
}

export async function lerKv<T>(chave: string): Promise<T | null> {
  return ((await req((await loja('kv', 'readonly')).get(chave))) as T | undefined) ?? null;
}
export async function gravarKv(chave: string, valor: unknown): Promise<void> {
  await req((await loja('kv', 'readwrite')).put(valor, chave));
}

/**
 * Consulta que também funciona sem internet: com rede, busca e guarda a cópia no aparelho; sem rede (ou servidor fora),
 * devolve a última cópia guardada. Use com `networkMode: 'always'` no useQuery (senão o TanStack nem tenta offline).
 */
export async function comCopia<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
  try {
    const v = await buscar();
    if (typeof indexedDB !== 'undefined') gravarKv(`copia:${chave}`, v).catch(() => undefined);
    return v;
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (typeof indexedDB !== 'undefined' && (status == null || status >= 500 || status === 401)) {
      const v = await lerKv<T>(`copia:${chave}`).catch(() => null);
      if (v != null) return v;
    }
    throw e;
  }
}

export const idLocal = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
