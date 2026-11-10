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
        descricao="O PTO é responsabilidade do Planejamento: cadastre aqui e escolha na linha da programação (montar). Vai para a coluna PTO do Excel do cliente."
      />
      <CadastrosSsma tipos={['PTO']} podeEditar={pode('planejador')}
        titulo="Quais PTOs estão valendo?" subtitulo="Inative o PTO substituído por uma revisão; renomear atualiza as programações em rascunho." />
    </>
  );
}
