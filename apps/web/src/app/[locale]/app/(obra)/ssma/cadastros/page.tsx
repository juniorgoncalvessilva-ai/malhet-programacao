'use client';

import { CadastrosSsma } from '@/components/Obra/CadastroSsma';
import { Cabecalho } from '@/components/Obra/ui';
import { Link } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';

export default function CadastrosSsmaPage() {
  const { editaSsma } = useObra();
  return (
    <>
      <Cabecalho
        eyebrow="Segurança · cadastros de SSMA"
        cor="var(--m-proc-administrar)"
        titulo="Técnicos, RAC, PTS, ART e ATA da obra"
      />
      <CadastrosSsma tipos={['TECNICO', 'RAC', 'PTS', 'ART', 'ATA']} podeEditar={editaSsma}
        titulo="O que a segurança pode escolher em cada linha?" />
    </>
  );
}
