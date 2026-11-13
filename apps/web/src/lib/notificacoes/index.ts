'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

/** Central de notificações (spec 076). */
export interface Notificacao {
  id: number; tipo: string; gravidade: 'info' | 'atencao' | 'critico'; titulo: string; texto: string | null; url: string | null; url_mobile: string | null;
  criada_em: string; lida_em: string | null;
}
export interface Contagem { nao_lidas: number; ultima_id: number | null }

export function useContagemNotificacoes() {
  const api = useApi();
  const { obra, simulando } = useObra();
  const q = useQuery({ queryKey: ['notificacoes', 'contagem', obra?.id, simulando], enabled: !!obra, refetchInterval: 30000,
    queryFn: () => api.get<Contagem>('/notificacoes/contagem') });
  useAvisoDoSistema(q.data);
  return q.data?.nao_lidas ?? 0;
}

export function useNotificacoes() {
  const api = useApi();
  const { obra } = useObra();
  return useQuery({ queryKey: ['notificacoes', 'lista', obra?.id], enabled: !!obra, queryFn: () => api.get<Notificacao[]>('/notificacoes') });
}

export function useMarcarLidas() {
  const api = useApi();
  const qc = useQueryClient();
  return useCallback(async (id?: number) => {
    await (id ? api.post(`/notificacoes/${id}/lida`) : api.post('/notificacoes/lidas'));
    qc.invalidateQueries({ queryKey: ['notificacoes'] });
  }, [api, qc]);
}

export const permissaoAviso = () => (typeof Notification === 'undefined' ? 'indisponivel' : Notification.permission);
export async function pedirPermissaoAviso(): Promise<NotificationPermission | 'indisponivel'> {
  if (typeof Notification === 'undefined') return 'indisponivel';
  return Notification.requestPermission();
}

/**
 * Com o app aberto (mesmo em segundo plano) e a permissão dada, chegou alerta novo → aviso do sistema no aparelho.
 * Com o app fechado não chega (precisaria de Web Push com servidor de envio — fica para depois).
 */
function useAvisoDoSistema(c: Contagem | undefined) {
  const api = useApi();
  const ultima = useRef<number | null>(null);
  useEffect(() => {
    if (!c?.ultima_id) return;
    const antes = ultima.current;
    ultima.current = c.ultima_id;
    if (antes == null || c.ultima_id <= antes || permissaoAviso() !== 'granted') return;
    api.get<Notificacao[]>('/notificacoes?so_nao_lidas=true&limite=3').then(async (ns) => {
      const n = ns.find((x) => x.id > antes);
      if (!n) return;
      const opcoes = { body: n.texto ?? '', tag: `malhet-${n.id}`, icon: '/brand/icon-192.png' };
      try {
        const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
        if (reg) await reg.showNotification(n.titulo, opcoes); else new Notification(n.titulo, opcoes); // eslint-disable-line no-new
      } catch { /* sem aviso do sistema: o sino continua mostrando */ }
    }).catch(() => undefined);
  }, [c?.ultima_id]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const quandoFoi = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
