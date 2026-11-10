'use client';

import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';

/** Telas da obra só montam com a obra escolhida: nenhuma consulta sai sem X-Obra-Id. */
export default function ObraLayout({ children }: { children: ReactNode }) {
  const { obra, carregando, superadmin } = useObra();
  if (obra) return <>{children}</>;
  if (carregando) return <p className="text-sm text-m-text-muted">Carregando obra…</p>;
  return (
    <div className="rounded-m-lg border border-dashed border-m-stroke p-8 text-center text-sm text-m-text-secondary">
      {superadmin
        ? <>Nenhuma obra ainda. <Link href="/app/admin/obras" className="font-semibold text-m-accent">Crie a primeira obra</Link> e dê acesso à equipe.</>
        : 'Você ainda não tem acesso a nenhuma obra. Peça ao administrador.'}
    </div>
  );
}
