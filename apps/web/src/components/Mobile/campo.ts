'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/programacao/useApi';
import type { DiaCampo } from '@/lib/api/types';

export const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const dataLonga = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
export const num = (n: number | null | undefined, casas = 2) => (n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: casas }));

export function useDiaCampo(data: string) {
  const api = useApi();
  return useQuery({ queryKey: ['campo', 'dia', data], queryFn: () => api.get<DiaCampo>(`/campo/dia?data=${data}`) });
}
