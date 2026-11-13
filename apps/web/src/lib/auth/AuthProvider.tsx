'use client';

/**
 * Autenticação pelo auth-kit (apps/api/vendor/auth_kit, rotas /api/auth/*).
 * - access token só em memória; refresh em cookie httpOnly + CSRF (cookie csrf_token → header X-CSRF-Token);
 * - no 401, tenta 1 refresh e repete; sem cookie, volta ao login;
 * - 2FA: login devolve mfa_required e o segundo envio leva mfa_code.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '@/lib/api/client';

export interface Usuario {
  id: string;
  email: string;
  roles: string[];
  admin: boolean;
  mfa_enabled?: boolean;
}

interface Resposta<T = Record<string, unknown>> {
  ok: boolean;
  status?: number;
  message?: string;
  message_key?: string;
  errors?: { key: string; field?: string | null }[];
  data?: T;
}

interface AuthCtx {
  usuario: Usuario | null;
  carregado: boolean;
  desabilitado: boolean;
  getToken: () => Promise<string | null>;
  entrar: (email: string, senha: string, mfa?: string) => Promise<{ mfa: boolean }>;
  sair: () => Promise<void>;
  cadastrar: (email: string, senha: string) => Promise<string>;
  verificarEmail: (token: string) => Promise<string>;
}

const Ctx = createContext<AuthCtx | null>(null);
/** Último usuário que entrou neste aparelho (sem token): o app de campo abre sem internet com ele (spec 063).
 * Nada é liberado no servidor por isso — cada chamada à API continua exigindo a sessão válida. */
const CHAVE_USUARIO = 'malhet.usuario';
const lembrar = (u: Usuario | null) => { try { if (u) localStorage.setItem(CHAVE_USUARIO, JSON.stringify(u)); else localStorage.removeItem(CHAVE_USUARIO); } catch { /* sem storage */ } };
const lembrado = (): Usuario | null => { try { return JSON.parse(localStorage.getItem(CHAVE_USUARIO) ?? 'null') as Usuario | null; } catch { return null; } };
export const AUTH_DESABILITADO = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';
const DEV: Usuario = { id: 'dev', email: 'dev@local', roles: ['admin'], admin: true };

const csrf = () =>
  typeof document === 'undefined' ? '' : decodeURIComponent(document.cookie.match(/(?:^|; )csrf_token=([^;]*)/)?.[1] ?? '');

async function chamar<T>(path: string, init: RequestInit = {}): Promise<Resposta<T>> {
  const headers = new Headers(init.headers);
  headers.set('Accept-Language', 'pt-BR');
  if (init.body) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${API_URL}/auth${path}`, { ...init, headers, credentials: 'include' });
  const body = (await res.json().catch(() => ({ ok: false, message: res.statusText }))) as Resposta<T>;
  return { ...body, ok: res.ok && body.ok !== false, status: res.status };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(AUTH_DESABILITADO ? DEV : null);
  const [carregado, setCarregado] = useState(AUTH_DESABILITADO);
  const token = useRef<string | null>(null);
  const renovando = useRef<Promise<string | null> | null>(null);

  const carregarMe = useCallback(async (t: string) => {
    const r = await chamar<Usuario>('/me', { headers: { Authorization: `Bearer ${t}` } });
    if (r.ok && r.data) {
      const roles = (r.data.roles as string[]) ?? [];
      const u = { ...r.data, roles, admin: roles.includes('admin') };
      setUsuario(u);
      lembrar(u);
    }
  }, []);

  const renovar = useCallback(async (): Promise<string | null> => {
    if (!csrf()) return null;
    renovando.current ??= (async () => {
      const r = await chamar<{ access_token: string }>('/refresh', { method: 'POST', headers: { 'X-CSRF-Token': csrf() } });
      // servidor fora/reiniciando (5xx, deploy): é como estar sem internet — não derruba a sessão do aparelho (spec 073)
      if ((r.status ?? 0) >= 500) throw new Error('servidor indisponível');
      token.current = r.ok ? r.data?.access_token ?? null : null;
      if (!token.current) setUsuario(null);
      return token.current;
    })().finally(() => { renovando.current = null; });
    return renovando.current;
  }, []);

  useEffect(() => {
    if (AUTH_DESABILITADO) return;
    renovar()
      .then((t) => (t ? carregarMe(t) : undefined))
      // sem internet: abre com o último usuário deste aparelho; quando a rede voltar, renova a sessão
      .catch(() => { const u = lembrado(); if (u) setUsuario(u); })
      .finally(() => setCarregado(true));
    const voltou = () => { if (!token.current) renovar().then((t) => (t ? carregarMe(t) : undefined)).catch(() => undefined); };
    window.addEventListener('online', voltou);
    return () => window.removeEventListener('online', voltou);
  }, [renovar, carregarMe]);

  const getToken = useCallback(async () => {
    if (AUTH_DESABILITADO) return null;
    if (token.current) {
      try {
        const exp = JSON.parse(atob(token.current.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp as number;
        if (exp * 1000 - Date.now() > 30_000) return token.current;
      } catch { /* renova */ }
    }
    return renovar();
  }, [renovar]);

  const entrar = useCallback(async (email: string, senha: string, mfa?: string) => {
    const r = await chamar<{ access_token: string; mfa_required: boolean }>('/login', {
      method: 'POST', body: JSON.stringify({ email, password: senha, mfa_code: mfa || undefined }),
    });
    if (!r.ok) throw new Error(r.message ?? 'Não foi possível entrar');
    if (r.data?.mfa_required) return { mfa: true };
    token.current = r.data?.access_token ?? null;
    if (token.current) await carregarMe(token.current);
    return { mfa: false };
  }, [carregarMe]);

  const sair = useCallback(async () => {
    if (!AUTH_DESABILITADO) await chamar('/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrf() } });
    token.current = null;
    lembrar(null);
    setUsuario(AUTH_DESABILITADO ? DEV : null);
  }, []);

  const cadastrar = useCallback(async (email: string, senha: string) => {
    const r = await chamar('/register', { method: 'POST', body: JSON.stringify({ email, password: senha, locale: 'pt-BR' }) });
    if (!r.ok) throw new Error(r.message ?? 'Não foi possível cadastrar');
    return r.message ?? 'Cadastro recebido. Confira seu e-mail.';
  }, []);

  const verificarEmail = useCallback(async (t: string) => {
    const r = await chamar('/verify-email', { method: 'POST', body: JSON.stringify({ token: t }) });
    if (!r.ok) throw new Error(r.message ?? 'Link inválido ou expirado');
    return r.message ?? 'E-mail confirmado.';
  }, []);

  const valor = useMemo<AuthCtx>(
    () => ({ usuario, carregado, desabilitado: AUTH_DESABILITADO, getToken, entrar, sair, cadastrar, verificarEmail }),
    [usuario, carregado, getToken, entrar, sair, cadastrar, verificarEmail],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSessao(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSessao fora do AuthProvider');
  return c;
}
