'use client';

import { PainelErros } from '@/components/Erros/PainelErros';
import { Cabecalho } from '@/components/Obra/ui';
import { useErrosAbertos } from '@/lib/erros/consultas';
import { useObra } from '@/lib/obra/ObraProvider';

/** Spec 098: erros que o app relatou sozinho (e os relatos das pessoas). Só o super admin. */
export default function ErrosPage() {
  const { superadminReal, carregando } = useObra();
  const n = useErrosAbertos().data?.abertos;
  if (!carregando && !superadminReal) return <p className="text-sm text-m-text-muted">Só o super admin vê os erros relatados.</p>;
  return (
    <>
      <Cabecalho eyebrow="Super Admin · erros relatados" cor="var(--m-proc-administrar)"
        titulo={n === undefined ? 'Erros relatados' : n ? `${n} problema${n > 1 ? 's' : ''} em aberto para olhar` : 'Nenhum erro em aberto'} />
      <PainelErros />
    </>
  );
}
