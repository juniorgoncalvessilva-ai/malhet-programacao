'use client';

import { AdminObras } from '@/components/Obra/AdminObras';
import { Cabecalho } from '@/components/Obra/ui';

/** Fora da obra: o Super Admin cria a primeira obra por aqui (o menu leva a Acessos e usuários). */
export default function AdminObrasPage() {
  return (
    <>
      <Cabecalho eyebrow="Super Admin · obras e usuários" cor="var(--m-proc-administrar)" titulo="Obras e usuários" />
      <AdminObras />
    </>
  );
}
