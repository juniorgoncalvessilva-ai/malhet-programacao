/**
 * Cliente do portal do líder (spec 111): sem conta do Malhet — a sessão é o token do portal (cabeçalho X-Portal-Token),
 * guardado só neste aparelho e por link. Vale 12 h; trocar/redefinir a senha ou bloquear derruba.
 */
import { API_URL, ApiError } from '@/lib/api/client';

const chave = (codigo: string) => `malhet.portal.${codigo}`;

export function lerToken(codigo: string): string | null {
  try { return localStorage.getItem(chave(codigo)); } catch { return null; }
}
export function guardarToken(codigo: string, token: string | null) {
  try { if (token) localStorage.setItem(chave(codigo), token); else localStorage.removeItem(chave(codigo)); } catch { /* sem storage */ }
}

export async function portal<T>(codigo: string, caminho: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = lerToken(codigo);
  if (token) headers['X-Portal-Token'] = token;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}/portal/${encodeURIComponent(codigo)}${caminho}`, {
    method: init.method ?? 'GET', headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let msg = res.status === 404 ? 'Este link não está mais ativo. Peça o link novo ao Planejamento.' : 'Não deu certo agora. Tente de novo.';
    let campo: string | null = null;
    try { const b = await res.json(); if (typeof b.detail === 'string' && res.status !== 404) msg = b.detail; campo = b.campo ?? null; } catch { /* sem corpo */ }
    throw new ApiError(res.status, msg, campo);
  }
  return res.json() as Promise<T>;
}

export interface Membro { cracha: string; nome: string; funcao: string | null; matricula: string | null }
export interface EquipePortal { id: number; nome: string; encarregado: string | null; membros: Membro[] }
export interface Destino { id: number; nome: string; encarregado: string }
export interface MinhasEquipes { nome: string; matricula: string | null; funcao: string | null; equipes: EquipePortal[]; destinos: Destino[] }
export interface Achado { cracha: string; nome: string; matricula: string | null; funcao: string | null; equipe: string | null }
export interface Sessao { token: string; trocar_senha: boolean; nome: string }
