/**
 * Cliente da API Python (FastAPI). O token do Clerk vai no Authorization; a API valida via JWKS.
 * Base: NEXT_PUBLIC_API_URL (padrão /backend/api, reescrito pelo Next para API_INTERNAL_URL — mesma origem,
 * então o cookie de refresh e o CSRF do auth-kit funcionam sem CORS).
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/backend/api';

export class ApiError extends Error {
  constructor(public status: number, message: string, public campo?: string | null) {
    super(message);
  }
}

export type TokenGetter = () => Promise<string | null>;

async function erro(res: Response): Promise<never> {
  let msg = res.statusText;
  let campo: string | null = null;
  try {
    const body = await res.json();
    msg = body.message ?? (typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail));
    campo = body.campo ?? null;
  } catch {
    /* sem corpo */
  }
  throw new ApiError(res.status, msg, campo);
}

export async function apiFetch<T>(path: string, getToken: TokenGetter, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  if (!res.ok) return erro(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiDownload(path: string, getToken: TokenGetter, nomePadrao: string, obraId?: number): Promise<number> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (obraId) headers['X-Obra-Id'] = String(obraId);
  const res = await fetch(`${API_URL}${path}`, { headers, credentials: 'include' });
  if (!res.ok) return erro(res);
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
  if (!res.ok) return erro(res);
  return res.blob();
}

/** POST de arquivo que devolve outro arquivo (ex.: .xer do P6 com a WBS acrescentada): baixa e devolve os cabeçalhos. */
export async function apiPostDownload(path: string, getToken: TokenGetter, corpo: FormData, nomePadrao: string, obraId?: number): Promise<Headers> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (obraId) headers['X-Obra-Id'] = String(obraId);
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', body: corpo, headers, credentials: 'include' });
  if (!res.ok) return erro(res);
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
