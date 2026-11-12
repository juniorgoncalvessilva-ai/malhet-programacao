'use client';

import { CadastrosSsma } from '@/components/Obra/CadastroSsma';
import { Cabecalho } from '@/components/Obra/ui';
import { useObra } from '@/lib/obra/ObraProvider';

export default function PtoPage() {
  const { pode } = useObra();
  return (
    <>
      <Cabecalho
        eyebrow="Planejamento · PTO"
        titulo="Planos de Trabalho de Obra (PTO)"
      />
      <CadastrosSsma tipos={['PTO']} podeEditar={pode('planejador')}
        titulo="Quais PTOs estão valendo?" />
    </>
  );
}
