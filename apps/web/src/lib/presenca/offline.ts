'use client';

import { loja, req } from '@/lib/offline/db';

/**
 * Guarda da presença no próprio celular (IndexedDB) — spec 063. A base (pessoas, códigos, rostos) e as leituras ficam
 * no aparelho; as leituras sobem em sequência quando houver internet (`sincronizar`). Nada aqui depende de rede.
 */

export interface PessoaBase {
  id: number; nome: string; matricula: string | null; cracha: string | null; funcao: string | null; situacao: string;
  equipe_id: number | null; codigos: string[]; nfc: string | null; face: number[] | null;
  /** Consentimento LGPD que vale hoje (spec 074): o aparelho decide sem internet se usa rosto, foto e localização. */
  lgpd?: ConsentimentoLgpd;
}
export interface ConsentimentoLgpd { biometria: boolean; foto_assinatura: boolean; localizacao: boolean; versao: number | null; situacao: 'pendente' | 'aceito' | 'recusado' | 'revogado' | 'desatualizado' }
export interface TermoLgpd { versao: number; titulo: string; texto: string; hash: string; finalidades: { chave: 'biometria' | 'foto_assinatura' | 'localizacao'; rotulo: string; descricao: string }[] }
export interface BasePresenca {
  gerado_em: string; distancia_max: number; pessoas: PessoaBase[];
  equipes: { id: number; nome: string; encarregado: string | null }[];
  /** Funções de contratação do de-para (cadastro simplificado já ligado à CPU) — spec 065. */
  funcoes?: { funcao_chave: string; funcao: string; recurso: string | null }[];
  termo_lgpd?: TermoLgpd;
}
/** Crachá ligado a uma pessoa no celular, esperando internet para ir ao servidor (spec 065). */
export interface VinculoLocal { colaborador_id: number; codigo?: string | null; nfc?: string | null }
export type Meio = 'nfc' | 'qr' | 'codigo' | 'facial' | 'manual';
export interface LeituraLocal {
  id_local: string; obra_id: number; colaborador_id: number; nome: string; data: string; hora: string; meio: Meio;
  enviada: boolean; erro?: string | null;
  /** Spec 069: depois de enviada — vale a leitura mais cedo da pessoa no dia (de qualquer celular). */
  valida?: boolean; hora_valida?: string; outro_celular?: boolean;
}
/** Presença já registrada no servidor por qualquer celular (a leitura válida do dia). */
export interface PresencaRemota { colaborador_id: number; hora: string; meio: Meio; id_local: string }

export async function lerBase(obraId: number): Promise<BasePresenca | null> {
  return ((await req((await loja('kv', 'readonly')).get(`base:${obraId}`))) as BasePresenca | undefined) ?? null;
}
export async function salvarBase(obraId: number, b: BasePresenca): Promise<void> {
  await req((await loja('kv', 'readwrite')).put(b, `base:${obraId}`));
}
/** Muda uma pessoa da base guardada no aparelho (ex.: aceite LGPD colhido sem internet vale na hora). */
export async function mudarPessoaBase(obraId: number, id: number, m: Partial<PessoaBase>): Promise<BasePresenca | null> {
  const b = await lerBase(obraId);
  if (!b) return null;
  const nova = { ...b, pessoas: b.pessoas.map((p) => (p.id === id ? { ...p, ...m } : p)) };
  await salvarBase(obraId, nova);
  return nova;
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

export async function vinculosPendentes(obraId: number): Promise<VinculoLocal[]> {
  return ((await req((await loja('kv', 'readonly')).get(`vinculos:${obraId}`))) as VinculoLocal[] | undefined) ?? [];
}
export async function guardarVinculo(obraId: number, v: VinculoLocal): Promise<void> {
  const lista = await vinculosPendentes(obraId);
  await req((await loja('kv', 'readwrite')).put([...lista, v], `vinculos:${obraId}`));
}
async function enviarVinculos(post: Post, obraId: number): Promise<void> {
  const lista = await vinculosPendentes(obraId);
  const resta: VinculoLocal[] = [];
  for (const v of lista) {
    try { await post('/presenca/vincular', v); } catch (e) {
      // sem rede: tenta depois; recusado pelo servidor (crachá de outra pessoa…): descarta para não travar a fila
      if (typeof navigator !== 'undefined' && navigator.onLine === false) resta.push(v);
      else if (!(e instanceof Error) || !/já é de|não encontrad|inválid/i.test(e.message)) resta.push(v);
    }
  }
  await req((await loja('kv', 'readwrite')).put(resta, `vinculos:${obraId}`));
}

export async function lerRemotos(obraId: number, data: string): Promise<PresencaRemota[]> {
  return ((await req((await loja('kv', 'readonly')).get(`remotos:${obraId}:${data}`))) as PresencaRemota[] | undefined) ?? [];
}
export async function salvarRemotos(obraId: number, data: string, lista: PresencaRemota[]): Promise<void> {
  await req((await loja('kv', 'readwrite')).put(lista, `remotos:${obraId}:${data}`));
}

export { idLocal } from '@/lib/offline/db';
export const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const normalizarCodigo = (v: string) => v.replace(/[\s:\-]/g, '').toUpperCase();

type Post = <T>(p: string, b: unknown) => Promise<T>;
let enviando: Promise<number> | null = null;

/** Sobe a fila da obra em lotes de 200 (uma vez por vez). Devolve quantas foram confirmadas. Sem rede, fica para depois. */
export function sincronizar(post: Post, obraId: number): Promise<number> {
  enviando ??= (async () => {
    let ok = 0;
    try {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) await enviarVinculos(post, obraId);
      for (;;) {
        const fila = (await pendentes(obraId)).slice(0, 200);
        if (!fila.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) break;
        const r = await post<{ aceitas: number; repetidas: number; erros: { id_local: string; erro: string }[];
          resultados?: { id_local: string; valida: boolean; hora_valida: string; outro_celular: boolean }[] }>('/presenca/leituras', {
          leituras: fila.map(({ id_local, colaborador_id, data, hora, meio }) => ({ id_local, colaborador_id, data, hora, meio, dispositivo: navigator.userAgent.slice(0, 120) })),
        });
        const comErro = new Map(r.erros.map((e) => [e.id_local, e.erro]));
        await marcar(fila.filter((l) => !comErro.has(l.id_local)).map((l) => l.id_local), { enviada: true });
        for (const [id, erro] of comErro) await marcar([id], { erro });
        for (const x of r.resultados ?? []) await marcar([x.id_local], { valida: x.valida, hora_valida: x.hora_valida, outro_celular: x.outro_celular });
        ok += r.aceitas + r.repetidas;
        if (fila.length < 200) break;
      }
    } catch { /* sem rede ou sessão: tenta de novo depois */ }
    return ok;
  })().finally(() => { enviando = null; });
  return enviando;
}
