'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { MAX_BARRA, MENU_MOBILE, MENU_PADRAO, type ItemMobile } from '@/components/Mobile/menu';
import { useApi } from '@/hooks/programacao/useApi';
import type { PapelObra } from '@/lib/api/types';
import { useSessao } from '@/lib/auth/AuthProvider';
import { useObra } from '@/lib/obra/ObraProvider';
import { comCopia } from '@/lib/offline/db';

/** Perfil da conta e menu do celular (specs 075 e 077). */
export interface Perfil { usuario_id: string; email: string; superadmin: boolean; nome_exibicao: string | null; telefone: string | null; tem_avatar: boolean; avatar_versao: number }
export interface MenuConfig { barra: string[]; destaque: string | null }
export interface RespostaMenu { meu: MenuConfig & { origem: 'pessoal' | 'perfil' | 'padrao' }; perfis: Record<PapelObra, MenuConfig & { personalizado: boolean }>; telas: string[]; max_barra: number }

export function usePerfil() {
  const api = useApi();
  const { usuario } = useSessao();
  return useQuery({ queryKey: ['perfil', usuario?.id], enabled: !!usuario, networkMode: 'always', retry: 1,
    queryFn: () => comCopia(`perfil:${usuario?.id}`, () => api.get<Perfil>('/perfil')) });
}

/** Foto do perfil (blob local). Guardada pela versão: trocar a foto troca a chave. */
export function useAvatar(perfil: Perfil | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ['avatar', perfil?.usuario_id, perfil?.avatar_versao], enabled: !!perfil?.tem_avatar, staleTime: Infinity, retry: 0,
    queryFn: async () => URL.createObjectURL(await api.blob('/perfil/avatar')),
  });
}

/** Nome para mostrar: o nome de exibição do perfil ou o começo do e-mail. */
export const nomeDe = (p: Perfil | undefined, email?: string | null) => {
  if (p?.nome_exibicao) return p.nome_exibicao;
  const base = (email ?? p?.email ?? '').split('@')[0].split(/[._]/)[0];
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
};
export const iniciaisDe = (nome: string, email?: string | null) =>
  (nome ? nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('') : (email ?? '?').slice(0, 2)).toUpperCase();

export function useMenuMobileConfig() {
  const api = useApi();
  const { obra, simulando } = useObra();
  const sufixo = simulando ? `?papel=${simulando}` : '';
  return useQuery({
    queryKey: ['menu-mobile', obra?.id, simulando], enabled: !!obra, networkMode: 'always', retry: 1,
    queryFn: () => comCopia(`${obra?.id}:menu-mobile${sufixo}`, () => api.get<RespostaMenu>(`/menu-mobile${sufixo}`)),
  });
}

/**
 * Barra de baixo que vale para a pessoa: ajuste pessoal → padrão do perfil na obra → padrão do sistema. Sempre filtrada
 * pelo que a pessoa pode ver; "Mais" lista todas as outras telas liberadas.
 */
export function useBarraMobile(): { barra: ItemMobile[]; destaque: ItemMobile | null; mais: ItemMobile[]; origem: string } {
  const { obra, podeVerMobile } = useObra();
  const q = useMenuMobileConfig();
  return useMemo(() => {
    const cfg: MenuConfig = q.data?.meu ?? (obra ? MENU_PADRAO[obra.papel] : MENU_PADRAO.leitor);
    const item = (u: string | null) => (u ? MENU_MOBILE.find((i) => i.url === u && podeVerMobile(i.url)) ?? null : null);
    let barra = cfg.barra.map(item).filter((x): x is ItemMobile => !!x).slice(0, MAX_BARRA);
    if (!barra.some((i) => i.url === '/m')) barra = [MENU_MOBILE[0], ...barra].slice(0, MAX_BARRA); // Início sempre à mão
    const destaque = item(cfg.destaque);
    const usados = new Set([...barra.map((i) => i.url), destaque?.url]);
    const mais = MENU_MOBILE.filter((i) => podeVerMobile(i.url) && !usados.has(i.url));
    return { barra, destaque, mais, origem: q.data?.meu.origem ?? 'padrao' };
  }, [q.data, obra, podeVerMobile]);
}
