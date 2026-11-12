'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useApi } from '@/hooks/programacao/useApi';
import { useObraOpcional } from '@/lib/obra/ObraProvider';
import type { MarcaObra } from '@/lib/api/types';

export function useMarcaObra() {
  const api = useApi();
  const obraId = useObraOpcional()?.obra?.id;
  return useQuery({ queryKey: ['marca-obra', obraId], enabled: !!obraId, queryFn: () => api.get<MarcaObra>('/obra/marca') });
}

/** URL (blob) da logo da obra; null quando não há. */
export function useLogo(qual: 'contratada' | 'contratante', existe: boolean | undefined, versao = 0) {
  const api = useApi();
  const obraId = useObraOpcional()?.obra?.id;
  return useQuery({
    queryKey: ['marca-obra', obraId, 'logo', qual, versao], enabled: !!existe, staleTime: Infinity,
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

/** Aba do navegador: "Contratada | Obra" e o ícone da logo da contratada (sem ela, o do Malhet). */
export function TituloAba() {
  const obra = useObraOpcional()?.obra;
  const pathname = usePathname();
  const m = useMarcaObra();
  const logo = useLogo('contratada', m.data?.contratada, m.data?.versao);
  const titulo = obra ? `${m.data?.nome_contratada || 'Malhet'} | ${obra.nome}` : null;
  useEffect(() => {
    if (!titulo) return;
    const aplicar = () => { if (document.title !== titulo) document.title = titulo; };
    aplicar();
    // o Next troca o <title> ao navegar: mantém o da obra
    const obs = new MutationObserver(aplicar);
    const el = document.querySelector('title');
    if (el) obs.observe(el, { childList: true, characterData: true, subtree: true });
    return () => obs.disconnect();
  }, [titulo, pathname]);
  useEffect(() => {
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
    if (!links.length) return;
    links.forEach((l) => { if (!l.dataset.original) l.dataset.original = l.href; l.href = logo.data ?? l.dataset.original; });
  }, [logo.data, pathname]);
  return null;
}
