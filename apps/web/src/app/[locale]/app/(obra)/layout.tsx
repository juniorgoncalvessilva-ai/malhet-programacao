'use client';

import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { itemAtivo } from '@/components/Malhet/Shell';
import { Link, useRouter } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';

/** Telas da obra só montam com a obra escolhida: nenhuma consulta sai sem X-Obra-Id. */
export default function ObraLayout({ children }: { children: ReactNode }) {
  const { obra, carregando, superadmin, podeVer } = useObra();
  const pathname = usePathname();
  const router = useRouter();
  const url = itemAtivo(pathname);
  const bloqueada = !!obra && !!url && !podeVer(url);
  // página não liberada para a pessoa: vai para a programação vigente (sempre aberta)
  useEffect(() => { if (bloqueada) router.replace('/app/vigente'); }, [bloqueada, router]);
  if (obra) return bloqueada ? <p className="text-sm text-m-text-muted">Página não liberada para você nesta obra.</p> : <>{children}</>;
  if (carregando) return <p className="text-sm text-m-text-muted">Carregando obra…</p>;
  return (
    <div className="rounded-m-lg border border-dashed border-m-stroke p-8 text-center text-sm text-m-text-secondary">
      {superadmin
        ? <>Nenhuma obra ainda. <Link href="/app/admin/obras" className="font-semibold text-m-accent">Crie a primeira obra</Link> e dê acesso à equipe.</>
        : 'Você ainda não tem acesso a nenhuma obra. Peça ao administrador.'}
    </div>
  );
}
