'use client';

import { useSessao } from '@/lib/auth/AuthProvider';
import { iniciaisDe, nomeDe, useAvatar, usePerfil } from '@/lib/perfil';

/** Foto do perfil (ou as iniciais) da pessoa logada — cabeçalho do web, Início e "Mais" do celular (spec 075). */
export function Avatar({ tamanho = 36, className = '' }: { tamanho?: number; className?: string }) {
  const { usuario } = useSessao();
  const p = usePerfil();
  const foto = useAvatar(p.data);
  const nome = nomeDe(p.data, usuario?.email);
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.36) };
  // eslint-disable-next-line @next/next/no-img-element
  if (foto.data) return <img src={foto.data} alt={`Foto de ${nome}`} style={estilo} className={`shrink-0 rounded-full object-cover ${className}`} />;
  return <span aria-hidden="true" style={estilo} className={`grid shrink-0 place-items-center rounded-full bg-m-accent-strong font-semibold text-m-on-accent ${className}`}>{iniciaisDe(nome, usuario?.email)}</span>;
}
