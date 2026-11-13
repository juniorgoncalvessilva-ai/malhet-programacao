'use client';

import { useEffect, useState } from 'react';
import { loja, req } from '@/lib/offline/db';

/**
 * Fila de registros feitos no campo (spec 072): o registro inteiro (dados + fotos) é gravado no aparelho ANTES de
 * qualquer envio e só sai da fila depois que o servidor confirma. Cada um tem um `id_local`: se a resposta se perder no
 * caminho e o envio for repetido, o servidor devolve o que já gravou (não duplica).
 * - pendente: esperando internet (ou o servidor) — tenta de novo sozinho;
 * - recusado: o servidor não aceitou (falta algo, cadastro mudou…) — fica guardado com o motivo até alguém resolver;
 * - enviado: confirmado; a cópia (com as fotos, para reenviar no WhatsApp) é apagada do aparelho depois de 7 dias.
 * As fotos ficam como bytes (ArrayBuffer): Blob no IndexedDB falha em alguns iPhones.
 */
export type TipoFila = 'auditoria' | 'etilometro' | 'lgpd' | 'evidencia';
export type EstadoFila = 'pendente' | 'enviado' | 'recusado';
export interface FotoFila { bytes: ArrayBuffer; tipo: string; momento: string }
export interface ItemFila<D = Record<string, unknown>, R = unknown> {
  id_local: string; obra_id: number; tipo: TipoFila; rotulo: string; criado_em: string;
  dados: D; fotos: FotoFila[]; estado: EstadoFila; tentativas: number; erro?: string | null;
  resultado?: R | null; enviado_em?: string | null;
}
/** Como cada tipo sobe para o servidor (o post é o do useApi; FormData quando há fotos). */
export type Enviar = (post: <T>(p: string, b: unknown) => Promise<T>, item: ItemFila) => Promise<unknown>;
const ENVIOS: Partial<Record<TipoFila, Enviar>> = {};
export function registrarEnvio(tipo: TipoFila, f: Enviar) { ENVIOS[tipo] = f; }

const EVENTO = 'malhet-fila';
const avisar = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO)); };

export async function fotoParaFila(b: Blob, momento: string): Promise<FotoFila> {
  return { bytes: await b.arrayBuffer(), tipo: b.type || 'image/jpeg', momento };
}
export const blobDaFoto = (f: FotoFila) => new Blob([f.bytes], { type: f.tipo });

export async function enfileirar(item: ItemFila): Promise<void> {
  await req((await loja('fila', 'readwrite')).put(item));
  avisar();
}

export async function itensDaFila(obraId: number, tipo?: TipoFila): Promise<ItemFila[]> {
  const st = await loja('fila', 'readonly');
  const todos = (await req(st.index('obra').getAll(IDBKeyRange.only(obraId)))) as ItemFila[];
  return todos.filter((x) => !tipo || x.tipo === tipo).sort((a, b) => a.criado_em.localeCompare(b.criado_em));
}

async function mudar(id: string, m: Partial<ItemFila>): Promise<ItemFila | null> {
  const st = await loja('fila', 'readwrite');
  const x = (await req(st.get(id))) as ItemFila | undefined;
  if (!x) return null;
  const novo = { ...x, ...m };
  await req(st.put(novo));
  return novo;
}

/** Tira um item da fila. Só para o que foi recusado e a pessoa confirmou descartar (ou o envio imediato falhou na validação). */
export async function removerDaFila(id: string): Promise<void> {
  await req((await loja('fila', 'readwrite')).delete(id));
  avisar();
}
/** Recusado → pendente de novo (depois de corrigir o cadastro no servidor, por exemplo). */
export async function tentarDeNovo(id: string): Promise<void> {
  await mudar(id, { estado: 'pendente', erro: null });
  avisar();
}

/** Erro de rede/servidor fora/sessão: tenta depois. Recusa de regra (4xx): não adianta repetir igual. */
const recusa = (e: unknown) => {
  const st = (e as { status?: number }).status;
  return st != null && st >= 400 && st < 500 && ![401, 403, 408, 409, 425, 429].includes(st);
};

/** Envia um item agora. Devolve o resultado do servidor; sem rede devolve null (fica pendente); recusado lança o erro. */
export async function enviarItem(post: Parameters<Enviar>[0], item: ItemFila): Promise<unknown | null> {
  const f = ENVIOS[item.tipo];
  if (!f) return null;
  try {
    const r = await f(post, item);
    await mudar(item.id_local, { estado: 'enviado', resultado: r, erro: null, enviado_em: new Date().toISOString(), tentativas: item.tentativas + 1 });
    avisar();
    return r;
  } catch (e) {
    if (recusa(e)) {
      await mudar(item.id_local, { estado: 'recusado', erro: (e as Error).message, tentativas: item.tentativas + 1 });
      avisar();
      throw e;
    }
    await mudar(item.id_local, { tentativas: item.tentativas + 1, erro: navigator.onLine === false ? null : (e as Error).message });
    avisar();
    return null;
  }
}

let rodando: Promise<number> | null = null;
/** Sobe tudo o que está pendente da obra, em ordem, um de cada vez. Para no primeiro sinal de falta de rede. */
export function processarFila(post: Parameters<Enviar>[0], obraId: number): Promise<number> {
  rodando ??= (async () => {
    let ok = 0;
    try {
      for (const it of await itensDaFila(obraId)) {
        if (it.estado !== 'pendente') continue;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
        try {
          const r = await enviarItem(post, it);
          if (r == null) break; // sem rede: os outros também não vão
          ok++;
        } catch { /* recusado: segue para o próximo */ }
      }
      await limparEnviados();
    } catch { /* banco indisponível: tenta depois */ }
    return ok;
  })().finally(() => { rodando = null; });
  return rodando;
}

/** Apaga do aparelho o que o servidor confirmou há mais de 7 dias. Nunca apaga pendente ou recusado. */
async function limparEnviados(): Promise<void> {
  const limite = new Date(Date.now() - 7 * 86400000).toISOString();
  const st = await loja('fila', 'readwrite');
  for (const x of (await req(st.getAll())) as ItemFila[]) {
    if (x.estado === 'enviado' && (x.enviado_em ?? x.criado_em) < limite) await req(st.delete(x.id_local));
  }
}

/** Itens da fila na tela, atualizando quando a fila muda (nesta aba). */
export function useFila(obraId: number | undefined, tipo?: TipoFila) {
  const [itens, setItens] = useState<ItemFila[]>([]);
  useEffect(() => {
    if (!obraId || typeof indexedDB === 'undefined') return;
    let vivo = true;
    const ler = () => itensDaFila(obraId, tipo).then((x) => { if (vivo) setItens(x); }).catch(() => undefined);
    ler();
    window.addEventListener(EVENTO, ler);
    return () => { vivo = false; window.removeEventListener(EVENTO, ler); };
  }, [obraId, tipo]);
  return itens;
}
