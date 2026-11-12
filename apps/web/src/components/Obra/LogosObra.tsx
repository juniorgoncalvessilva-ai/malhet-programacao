'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/programacao/useApi';
import type { MarcaObra } from '@/lib/api/types';

export function useMarcaObra() {
  const api = useApi();
  return useQuery({ queryKey: ['marca-obra'], queryFn: () => api.get<MarcaObra>('/obra/marca') });
}

/** URL (blob) da logo da obra; null quando não há. */
export function useLogo(qual: 'contratada' | 'contratante', existe: boolean | undefined, versao = 0) {
  const api = useApi();
  return useQuery({
    queryKey: ['marca-obra', 'logo', qual, versao], enabled: !!existe, staleTime: Infinity,
    queryFn: async () => URL.createObjectURL(await api.blob(`/obra/marca/logo/${qual}`)),
  });
}

/** Logos dos documentos: contratante (cliente) e contratada; sem nenhuma, a do Malhet. */
export function LogosObra({ altura = 40, className = '' }: { altura?: number; className?: string }) {
  const m = useMarcaObra();
  const cte = useLogo('contratante', m.data?.contratante, m.data?.versao);
  const cda = useLogo('contratada', m.data?.contratada, m.data?.versao);
  const urls = [cte.data, cda.data].filter(Boolean) as string[];
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* eslint-disable @next/next/no-img-element */}
      {urls.length ? urls.map((u, i) => <img key={u} src={u} alt={i === 0 && cte.data ? 'Logo do contratante' : 'Logo da contratada'} style={{ height: altura }} className="w-auto object-contain" />)
        : <img src="/brand/malhet.svg" alt="Malhet" style={{ height: altura * 0.75 }} className="w-auto" />}
      {/* eslint-enable @next/next/no-img-element */}
    </div>
  );
}
