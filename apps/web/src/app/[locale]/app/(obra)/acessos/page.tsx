'use client';

import { AcessosDaObra } from '@/components/Obra/Acessos';
import { AdminObras } from '@/components/Obra/AdminObras';
import { Cabecalho } from '@/components/Obra/ui';
import { useObra } from '@/lib/obra/ObraProvider';

/** Acessos e usuários: quem acessa esta obra, com qual papel e quais páginas; o Super Admin vê também as obras e contas. */
export default function AcessosPage() {
  const { obra, pode, superadmin } = useObra();
  if (!obra) return null;
  return (
    <>
      <Cabecalho eyebrow="Administrar · acessos e usuários" cor="var(--m-proc-administrar)" titulo="Acessos e usuários" />
      {pode('admin')
        ? <AcessosDaObra obraId={obra.id} obraNome={obra.nome} />
        : <p className="text-sm text-m-text-muted">Só o admin da obra gerencia acessos.</p>}
      {superadmin && <AdminObras />}
    </>
  );
}
