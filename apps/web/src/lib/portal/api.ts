/**
 * Cliente do portal do encarregado (specs 111 e 115): endereço fixo `/encarregado`, sem conta do Malhet — a sessão é o
 * token do portal (cabeçalho X-Portal-Token), guardado só neste aparelho. Vale 12 h; trocar/redefinir a senha ou
 * bloquear derruba. O aparelho lembra a última obra para abrir já com a marca da empresa.
 */
import { API_URL, ApiError } from '@/lib/api/client';

/**
 * Spec 147: o mesmo portal serve o encarregado (`/encarregado`) e o apontador (`/apontador`). Cada perfil guarda a sua sessão
 * e o seu endereço no aparelho — o celular do apontador que também abre a tela do encarregado não mistura as duas.
 */
export type PerfilPortal = 'lider' | 'apontador';
let perfilAtual: PerfilPortal = 'lider';
export function usarPerfil(p: PerfilPortal) { perfilAtual = p; }
export const raizDoPerfil = (p: PerfilPortal = perfilAtual) => (p === 'apontador' ? '/apontador' : '/encarregado');
const chave = (k: string) => `malhet.${perfilAtual === 'apontador' ? 'apontador' : 'encarregado'}.${k}`;

export function lerToken(): string | null {
  try { return localStorage.getItem(chave('token')); } catch { return null; }
}
export function guardarToken(token: string | null) {
  try { if (token) localStorage.setItem(chave('token'), token); else localStorage.removeItem(chave('token')); } catch { /* sem storage */ }
}
export function lerObra(): number | null {
  try { const v = Number(localStorage.getItem(chave('obra'))); return v > 0 ? v : null; } catch { return null; }
}
export function guardarObra(obra: number) {
  try { localStorage.setItem(chave('obra'), String(obra)); } catch { /* sem storage */ }
}

/** Spec 117: o endereço da empresa/obra deste aparelho (`/encarregado/<empresa>/<obra>`); `/encarregado` volta para ele. */
export function lerRota(): string | null {
  try { const v = localStorage.getItem(chave('rota')); return v && v.startsWith(`${raizDoPerfil()}/`) ? v : null; } catch { return null; }
}
export function guardarRota(endereco: string) {
  try { localStorage.setItem(chave('rota'), endereco); } catch { /* sem storage */ }
}
/** O endereço da API vem como o do encarregado; na rota do apontador vira `/apontador/...` (mesma regra, spec 147). */
export const enderecoDoPerfil = (endereco: string) => endereco.replace(/^\/encarregado(?=\/|$)/, raizDoPerfil());

export async function portal<T>(caminho: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = lerToken();
  if (token) headers['X-Portal-Token'] = token;
  const form = init.body instanceof FormData;
  if (init.body !== undefined && !form) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}/portal${caminho}`, {
    method: init.method ?? 'GET', headers,
    body: init.body === undefined ? undefined : form ? (init.body as FormData) : JSON.stringify(init.body),
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
export interface RotaPortal { empresa: string; obra: string | null; endereco: string; endereco_empresa: string }
export interface Sessao { token?: string; trocar_senha?: boolean; nome?: string; obra_id?: number; escolher?: ObraParaEscolher[]; rota?: RotaPortal; perfil?: PerfilPortal }

// ---- apontador (spec 147) ----------------------------------------------------------------------------------------
export interface PresencaDia { hora: string; meio: string; por: string }
export interface PessoaApontador { cracha: string; nome: string; matricula: string | null; funcao: string | null; colaborador_id: number | null; papel: string | null; presenca: PresencaDia | null }
export interface EquipeApontador { id: number; nome: string; encarregado: string | null; pessoas: PessoaApontador[]; presentes: number; total: number }
export interface DadosApontador { data: string; nome: string; matricula: string | null; funcao: string | null; obra_id: number; equipes: EquipeApontador[]; sem_equipe: PessoaApontador[]; presentes: number }
export interface MemoriaPortal { chave: string; titulo: string; valor: string; formula: string; passos: { descricao: string; conta: string; resultado: string; destaque: boolean }[]; fontes: { dado: string; valor: string; origem: string; local: string | null }[]; notas: string[] }
export interface EquipamentoDia {
  id: number; nome: string; tipo: string | null; placa: string | null; tag: string | null; operador: { id: number; nome: string; matricula: string | null } | null;
  operador_texto: string | null; situacao: string; mobilizado_em: string | null; dias: number | null; memoria: MemoriaPortal | null;
  dia: { situacao: string; situacao_nome: string; horas: number | null; equipe_id: number | null; observacao: string | null; por: string } | null;
}
export interface EquipamentosApontador { data: string; itens: EquipamentoDia[]; totais: Record<string, number>; equipes: { id: number; nome: string; encarregado: string | null }[] }
export interface LinhaProducao { id: number; codigo: string; descricao: string; cwp: string | null; unidade: string | null; encarregado: string | null; equipe: string | null;
  previsto: (number | null)[]; realizado: (number | null)[]; total_previsto: number; total_realizado: number; percentual: number | null; memoria: MemoriaPortal }
export interface Producao { programacao: { id: number; titulo: string } | null; dias?: { data: string; dia: string }[]; areas?: { local: string; area: string; linhas: LinhaProducao[] }[] }

/** Arquivo (foto) do portal com o token do líder: o <img> sozinho não manda o cabeçalho. */
export async function portalBlob(caminho: string): Promise<Blob> {
  return (await portalArquivo(caminho)).blob;
}

/** O arquivo e o nome que o servidor deu (Content-Disposition), para baixar com data, frente e tipo no nome. */
export async function portalArquivo(caminho: string): Promise<{ blob: Blob; nome: string | null }> {
  const token = lerToken();
  const res = await fetch(`${API_URL}/portal${caminho}`, { headers: token ? { 'X-Portal-Token': token } : {} });
  if (!res.ok) throw new ApiError(res.status, 'Não consegui abrir a foto');
  const nome = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? null;
  return { blob: await res.blob(), nome };
}
