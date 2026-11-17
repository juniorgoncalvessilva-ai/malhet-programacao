/**
 * Cliente da API Python (FastAPI). O token do Clerk vai no Authorization; a API valida via JWKS.
 * Base: NEXT_PUBLIC_API_URL (padrão /backend/api, reescrito pelo Next para API_INTERNAL_URL — mesma origem,
 * então o cookie de refresh e o CSRF do auth-kit funcionam sem CORS).
 */
import { apiRespondeu, relatarFalhaApi } from '@/lib/erros/relatar';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/backend/api';

export class ApiError extends Error {
  constructor(public status: number, message: string, public campo?: string | null, public codigoErro?: string | null) {
    super(message);
  }
}

export type TokenGetter = () => Promise<string | null>;

/** A API respondeu (qualquer coisa que não seja o proxy dizendo 502/503): zera a contagem de "fora do ar" (spec 106). */
function chegou(res: Response) {
  if (res.status !== 502 && res.status !== 503) apiRespondeu();
}

async function erro(res: Response, metodo = 'GET', caminho = ''): Promise<never> {
  let msg = res.statusText;
  let campo: string | null = null;
  let servidor: { codigo?: string | null; ref?: string | null } | undefined;
  try {
    const body = await res.json();
    msg = body.message ?? (typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail));
    campo = body.campo ?? null;
    servidor = { codigo: body.erro_id, ref: body.erro_ref };
  } catch {
    /* sem corpo */
  }
  // spec 098: falha do servidor (5xx) é relatada à equipe sozinha e a pessoa recebe o código
  if (res.status >= 500) relatarFalhaApi(metodo, caminho, res.status, msg || res.statusText, servidor);
  if (res.status >= 502 && res.status <= 504) msg = 'O servidor não respondeu. Tente de novo em instantes.';
  throw new ApiError(res.status, msg, campo, servidor?.codigo);
}

export async function apiFetch<T>(path: string, getToken: TokenGetter, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  chegou(res);
  if (!res.ok) return erro(res, init.method ?? 'GET', path);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiDownload(path: string, getToken: TokenGetter, nomePadrao: string, obraId?: number): Promise<number> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (obraId) headers['X-Obra-Id'] = String(obraId);
  const res = await fetch(`${API_URL}${path}`, { headers, credentials: 'include' });
  chegou(res);
  if (!res.ok) return erro(res, 'GET', path);
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const nome = /filename="([^"]+)"/.exec(cd)?.[1] ?? nomePadrao;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
  return Number(res.headers.get('X-Itens') ?? 0);
}

/** Arquivo como Blob (ex.: foto para mostrar na tela: o <img> sozinho não manda o token nem a obra). */
export async function apiBlob(path: string, getToken: TokenGetter, obraId?: number): Promise<Blob> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (obraId) headers['X-Obra-Id'] = String(obraId);
  const res = await fetch(`${API_URL}${path}`, { headers, credentials: 'include' });
  chegou(res);
  if (!res.ok) return erro(res, 'GET', path);
  return res.blob();
}

/** POST de arquivo que devolve outro arquivo (ex.: .xer do P6 com a WBS acrescentada): baixa e devolve os cabeçalhos. */
export async function apiPostDownload(path: string, getToken: TokenGetter, corpo: FormData, nomePadrao: string, obraId?: number): Promise<Headers> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (obraId) headers['X-Obra-Id'] = String(obraId);
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', body: corpo, headers, credentials: 'include' });
  chegou(res);
  if (!res.ok) return erro(res, 'POST', path);
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const nome = /filename\*=UTF-8''([^;]+)/.exec(cd)?.[1];
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome ? decodeURIComponent(nome) : (/filename="([^"]+)"/.exec(cd)?.[1] ?? nomePadrao);
  a.click();
  URL.revokeObjectURL(url);
  return res.headers;
}

export const qs = (p: Record<string, string | number | boolean | undefined | null>) =>
  '?' +
  Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
