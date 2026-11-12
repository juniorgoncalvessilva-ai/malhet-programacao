'use client';

import { useQuery } from '@tanstack/react-query';
import { ImpressaoProgramacao } from '@/components/Obra/ImpressaoProgramacao';
import { useApi } from '@/hooks/programacao/useApi';

/** Programação vigente: o que está valendo na obra, como foi emitida (para quem não monta programação). */
export default function VigentePage() {
  const api = useApi();
  const q = useQuery({ queryKey: ['programacao', 'vigente'], queryFn: () => api.get<{ id: number | null; revisao: number | null; titulo: string | null }>('/programacoes/vigente') });
  if (q.isLoading) return <p className="text-sm text-m-text-muted">Carregando…</p>;
  if (!q.data?.id) return <p className="rounded-m-lg border border-dashed border-m-stroke p-8 text-center text-sm text-m-text-secondary">Nenhuma programação emitida ainda.</p>;
  return <ImpressaoProgramacao id={q.data.id} vigente />;
}
