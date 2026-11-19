/**
 * Cliente do portal do encarregado (specs 111 e 115): endereço fixo `/encarregado`, sem conta do Malhet — a sessão é o
 * token do portal (cabeçalho X-Portal-Token), guardado só neste aparelho. Vale 12 h; trocar/redefinir a senha ou
 * bloquear derruba. O aparelho lembra a última obra para abrir já com a marca da empresa.
 */
import { API_URL, ApiError } from '@/lib/api/client';

const TOKEN = 'malhet.encarregado.token';
const OBRA = 'malhet.encarregado.obra';

export function lerToken(): string | null {
  try { return localStorage.getItem(TOKEN); } catch { return null; }
}
export function guardarToken(token: string | null) {
  try { if (token) localStorage.setItem(TOKEN, token); else localStorage.removeItem(TOKEN); } catch { /* sem storage */ }
}
export function lerObra(): number | null {
  try { const v = Number(localStorage.getItem(OBRA)); return v > 0 ? v : null; } catch { return null; }
}
export function guardarObra(obra: number) {
  try { localStorage.setItem(OBRA, String(obra)); } catch { /* sem storage */ }
}

export async function portal<T>(caminho: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = lerToken();
  if (token) headers['X-Portal-Token'] = token;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}/portal${caminho}`, {
    method: init.method ?? 'GET', headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let msg = 'Não deu certo agora. Tente de novo.';
    let campo: string | null = null;
    try { const b = await res.json(); if (typeof b.detail === 'string') msg = b.detail; campo = b.campo ?? null; } catch { /* sem corpo */ }
    throw new ApiError(res.status, msg, campo);
  }
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}

export interface ObraParaEscolher { obra_id: number; obra: string; empresa: string | null }
export interface Membro { cracha: string; nome: string; funcao: string | null; matricula: string | null }
export interface EquipePortal { id: number; nome: string; encarregado: string | null; membros: Membro[] }
export interface Destino { id: number; nome: string; encarregado: string }
export interface MembroPedido { cracha: string; nome: string; matricula: string | null; funcao: string | null; equipe: string | null }
export interface PedidoEquipe {
  id: number; disciplina: string | null; membros: MembroPedido[]; observacao: string | null; situacao: 'pendente' | 'aprovado' | 'recusado';
  motivo: string | null; equipe_id: number | null; criado_em: string | null; decidido_em: string | null;
}
export interface MinhasEquipes { nome: string; matricula: string | null; funcao: string | null; equipes: EquipePortal[]; destinos: Destino[]; pedidos: PedidoEquipe[]; obra_id: number }
export interface Achado { cracha: string; nome: string; matricula: string | null; funcao: string | null; equipe: string | null }
export interface Sessao { token?: string; trocar_senha?: boolean; nome?: string; obra_id?: number; escolher?: ObraParaEscolher[] }
