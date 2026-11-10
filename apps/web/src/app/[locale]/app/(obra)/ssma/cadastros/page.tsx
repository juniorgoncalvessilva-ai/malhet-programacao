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
        descricao={<>O que for cadastrado aqui aparece nas listas suspensas da <Link href="/app/ssma" className="font-semibold text-m-accent">SSMA da programação</Link>. Renomear atualiza as programações em rascunho; item em uso não é excluído, só inativado. O PTO é do Planejamento: fica em <Link href="/app/pto" className="font-semibold text-m-accent">PTO (planejamento)</Link>.</>}
      />
      <CadastrosSsma tipos={['TECNICO', 'RAC', 'PTS', 'ART', 'ATA']} podeEditar={editaSsma}
        titulo="O que a segurança pode escolher em cada linha?" subtitulo="Use a validade para enxergar documentos vencidos ou perto de vencer." />
    </>
  );
}
