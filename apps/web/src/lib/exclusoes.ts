/** Spec 112: quem pode excluir auditorias e fotos do book (super admin ou habilitado por ele) — a tela só mostra a lixeira para estes. */
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/programacao/useApi';

export interface MinhaExclusao { pode_excluir: boolean; superadmin: boolean; habilitado: boolean }

export function usePodeExcluir() {
  const api = useApi();
  const q = useQuery({ queryKey: ['exclusoes-eu'], queryFn: () => api.get<MinhaExclusao>('/exclusoes/eu'), staleTime: 60_000 });
  return !!q.data?.pode_excluir;
}
