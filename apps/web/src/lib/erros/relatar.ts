/**
 * Relato automático de erros (spec 098): quando o app tenta algo e não consegue, ele mesmo avisa a equipe Malhet —
 * de qual tela partiu, qual ação falhou e em que versão. A pessoa não precisa saber explicar.
 *
 * - Fila no aparelho (localStorage): sem internet, guarda e envia depois; o id do aparelho evita duplicar no servidor.
 * - Não manda corpo de requisição nem dado digitado; o servidor ainda mascara e-mail, CPF, telefone e números longos.
 * - Erros iguais em sequência viram um só (30 s). Ruído do navegador (extensões, ResizeObserver) é ignorado.
 * - Falha que a pessoa percebe (API 5xx, tela que quebrou) mostra o aviso com o código; erro solto de script só é enviado.
 * - 502/503 por menos de 90 s é deploy (a API reiniciando): nem relato nem aviso (spec 106).
 */
import { emAppNativo } from '@/lib/presenca/leitores';

const API = process.env.NEXT_PUBLIC_API_URL ?? '/backend/api';
const VERSAO = process.env.NEXT_PUBLIC_VERSAO ?? '';
const FILA = 'malhet.erros.fila';
const MAX_FILA = 30;

export type TipoErro = 'js' | 'promessa' | 'tela' | 'api' | 'manual';
export interface Relato {
  id_local: string; origem: 'web' | 'campo' | 'nativo'; tipo: TipoErro; mensagem: string; local: string;
  acao?: string; status?: number; pilha?: string; comentario?: string; versao: string;
}
/** O que o aviso mostra: o código para citar e o id para completar com "o que você fazia". */
export interface AvisoErro { codigo: string; idLocal: string; titulo: string }
export const EVENTO_AVISO = 'malhet:erro';

let pegarToken: (() => Promise<string | null>) | null = null;
const recentes = new Map<string, number>();

/** Quem tem a sessão (CapturaErros) entrega o token: com ele o relato vai com a conta; sem, vai anônimo. */
export function configurarRelatos(getToken: () => Promise<string | null>) { pegarToken = getToken; }

const novoId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '')
  : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
export const codigoDe = (id: string) => `E-${id.replace(/[^0-9a-f]/gi, '').slice(0, 6).toUpperCase()}`;

const origem = (): Relato['origem'] => {
  try { if (emAppNativo()) return 'nativo'; } catch { /* sem capacitor */ }
  return /\/m(\/|$)/.test(location.pathname) ? 'campo' : 'web';
};

/**
 * Spec 141. Sem rede (ou a conexão caiu no meio da resposta — o Safari diz só "network error") não é defeito do Malhet:
 * a tela mostra "sem conexão" e tenta de novo, sem relato.
 */
const REDE = /^(TypeError: )?network error$|Failed to fetch|^Load failed$|NetworkError when attempting|net::ERR_|network connection was lost|Internet connection appears to be offline|ERR_INTERNET_DISCONNECTED/i;
export const ehErroDeRede = (e: { message?: string } | string | null | undefined) => {
  const t = typeof e === 'string' ? e : e?.message ?? '';
  return REDE.test(t.trim()) || (typeof navigator !== 'undefined' && navigator.onLine === false && /fetch|network|load/i.test(t));
};

/**
 * Spec 141. Promessa rejeitada com um Event (imagem que não abriu, FileReader, WebSocket) virava "[object Event]" — sem
 * pista nenhuma. Descreve o evento: tipo, elemento e endereço (sem data:/blob:, que só trazem bytes).
 */
export function descreverMotivo(r: unknown): { mensagem: string; pilha?: string } {
  if (r instanceof Error) return { mensagem: r.message || r.name, pilha: r.stack };
  if (typeof Event !== 'undefined' && r instanceof Event) {
    const alvo = r.target as (EventTarget & { tagName?: string; src?: string; currentSrc?: string; url?: string; error?: { message?: string } | null }) | null;
    const nome = alvo?.tagName ? `<${alvo.tagName.toLowerCase()}>` : alvo?.constructor?.name ?? 'objeto';
    const end = alvo?.currentSrc || alvo?.src || alvo?.url || '';
    const onde = end.startsWith('data:') ? ' (imagem em memória)' : end.startsWith('blob:') ? ' (arquivo do aparelho)' : end ? ` ${end.split('?')[0].slice(0, 160)}` : '';
    const det = alvo?.error?.message ? `: ${alvo.error.message}` : '';
    return { mensagem: `Evento "${r.type}" em ${nome}${onde}${det}` };
  }
  if (r && typeof r === 'object') {
    const o = r as { message?: unknown; stack?: unknown };
    if (typeof o.message === 'string') return { mensagem: o.message, pilha: typeof o.stack === 'string' ? o.stack : undefined };
    try { return { mensagem: JSON.stringify(r).slice(0, 300) }; } catch { /* circular */ }
  }
  return { mensagem: String(r ?? '') };
}

const RUIDO = [/ResizeObserver loop/i, /^Script error\.?$/i, /AbortError|The user aborted|signal is aborted/i, /Non-Error promise rejection captured/i];
const ehRuido = (mensagem: string, pilha?: string) =>
  RUIDO.some((r) => r.test(mensagem)) || /(chrome|moz|safari)-extension:\/\//.test(pilha ?? '');

function lerFila(): Relato[] {
  try { return JSON.parse(localStorage.getItem(FILA) ?? '[]') as Relato[]; } catch { return []; }
}
function gravarFila(f: Relato[]) {
  try { localStorage.setItem(FILA, JSON.stringify(f.slice(-MAX_FILA))); } catch { /* sem storage */ }
}

let enviando = false;
/** Manda o que está na fila (até 20 por vez). Chamada ao relatar, ao abrir o app e quando a rede volta. */
export async function enviarFila(): Promise<void> {
  if (enviando || typeof window === 'undefined' || !navigator.onLine) return;
  const fila = lerFila();
  if (!fila.length) return;
  enviando = true;
  try {
    const lote = fila.slice(0, 20);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = await pegarToken?.().catch(() => null);
    if (token) headers.Authorization = `Bearer ${token}`;
    const obra = (() => { try { return localStorage.getItem('malhet.obra'); } catch { return null; } })();
    if (obra) headers['X-Obra-Id'] = obra;
    const r = await fetch(`${API}/erros`, { method: 'POST', headers, body: JSON.stringify({ relatos: lote }), credentials: 'include', keepalive: true });
    if (r.ok || r.status === 422) { // aceito (ou recusado de vez): sai da fila
      const enviados = new Set(lote.map((x) => x.id_local));
      gravarFila(lerFila().filter((x) => !enviados.has(x.id_local)));
    }
  } catch { /* sem rede: fica na fila */ } finally { enviando = false; }
  if (lerFila().length && navigator.onLine) setTimeout(() => { void enviarFila(); }, 2000);
}

/** Relata um erro. Devolve o aviso (código) ou null quando foi ignorado (ruído ou repetido). */
export function relatarErro(e: { tipo: TipoErro; mensagem: string; pilha?: string; acao?: string; status?: number; comentario?: string; avisar?: boolean; titulo?: string }): AvisoErro | null {
  if (typeof window === 'undefined') return null;
  const mensagem = (e.mensagem || '').slice(0, 500);
  if (e.tipo !== 'manual' && ehRuido(mensagem, e.pilha)) return null;
  if ((e.tipo === 'js' || e.tipo === 'promessa' || e.tipo === 'tela') && ehErroDeRede(mensagem)) return null; // spec 141: sem rede
  const chave = `${e.tipo}|${mensagem}|${location.pathname}|${e.acao ?? ''}`;
  const agora = Date.now();
  if (e.tipo !== 'manual' && agora - (recentes.get(chave) ?? 0) < 30_000) return null;
  recentes.set(chave, agora);
  const r: Relato = {
    id_local: novoId(), origem: origem(), tipo: e.tipo, mensagem: mensagem || (e.comentario ? 'Relato da pessoa' : 'Erro sem mensagem'),
    local: location.pathname, acao: e.acao, status: e.status, pilha: e.pilha?.slice(0, 6000), comentario: e.comentario, versao: VERSAO,
  };
  gravarFila([...lerFila(), r]);
  void enviarFila();
  const aviso = { codigo: codigoDe(r.id_local), idLocal: r.id_local, titulo: e.titulo ?? 'Não deu certo desta vez' };
  if (e.avisar) window.dispatchEvent(new CustomEvent<AvisoErro>(EVENTO_AVISO, { detail: aviso }));
  return aviso;
}

/**
 * Janela de deploy (spec 106): enquanto a API reinicia, o proxy responde 502/503 por alguns segundos. Isso não é erro para
 * relatar nem para avisar a pessoa — as consultas automáticas (mudanças, notificações, presença) tentam de novo sozinhas.
 * Só se a API ficar sem responder por mais de 90 s vai um único relato "API indisponível". Qualquer resposta da API zera.
 */
const TOLERANCIA_FORA = 90_000;
let foraDesde: number | null = null;
let foraRelatado = false;
/** Chamada pelo cliente a cada resposta que chegou da API (mesmo 4xx): ela está no ar. */
export function apiRespondeu() { foraDesde = null; foraRelatado = false; }

/** Chamada da API que falhou no servidor (5xx). Se o servidor já guardou (erro_ref), só mostra o aviso com o código dele. */
export function relatarFalhaApi(metodo: string, caminho: string, status: number, mensagem: string, servidor?: { codigo?: string | null; ref?: string | null }) {
  if (typeof window === 'undefined' || status < 500) return;
  const acao = `${metodo.toUpperCase()} ${caminho.split('?')[0]}`;
  if (status === 502 || status === 503) {
    const agora = Date.now();
    foraDesde ??= agora;
    if (foraRelatado || agora - foraDesde < TOLERANCIA_FORA) return;
    foraRelatado = true;
    relatarErro({ tipo: 'api', mensagem: `API indisponível há mais de ${Math.round((agora - foraDesde) / 1000)} s (último: ${status} em ${acao})`,
      acao: 'API indisponível', status, avisar: true, titulo: 'O servidor está fora do ar' });
    return;
  }
  if (servidor?.codigo && servidor.ref) {
    window.dispatchEvent(new CustomEvent<AvisoErro>(EVENTO_AVISO, { detail: { codigo: servidor.codigo, idLocal: servidor.ref, titulo: 'O servidor não conseguiu concluir' } }));
    return;
  }
  relatarErro({ tipo: 'api', mensagem: `${status} em ${acao}: ${mensagem}`, acao, status, avisar: true,
    titulo: status >= 502 && status <= 504 ? 'O servidor não respondeu' : 'O servidor não conseguiu concluir' });
}

/** "O que você estava fazendo?" — completa um relato já enviado (ou ainda na fila). */
export async function comentarRelato(idLocal: string, comentario: string): Promise<void> {
  const fila = lerFila();
  const naFila = fila.find((x) => x.id_local === idLocal);
  if (naFila) { naFila.comentario = comentario; gravarFila(fila); return enviarFila(); }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await pegarToken?.().catch(() => null);
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${API}/erros/comentario`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ id_local: idLocal, comentario }) });
  if (!r.ok) throw new Error('Não foi possível enviar agora. Tente de novo em instantes.');
}
