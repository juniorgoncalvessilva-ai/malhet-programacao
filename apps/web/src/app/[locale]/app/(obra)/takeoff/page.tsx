'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ProjetosTakeoff } from '@/components/Documentos/ProjetosTakeoff';
import { TakeoffProjeto } from '@/components/Documentos/TakeoffProjeto';
import { Carregando } from '@/components/Obra/Esqueleto';
import { Cabecalho, Painel } from '@/components/Obra/ui';

export default function TakeoffPage() {
  return <Suspense fallback={<Carregando />}><Takeoff /></Suspense>;
}

/**
 * Take-off do projeto (specs 124 e 127): quantidades lidas dos desenhos — tabela de ferros e resumo de aço conferidos pela
 * NBR 7480, anotações com unidade, camadas e blocos —, aceitas com o item da PQ e a frente, comparadas com o take-off da
 * planilha e levadas ao IWP. Tela própria, fora de Documentos; `?doc=` mostra só um documento.
 */
function Takeoff() {
  const params = useSearchParams();
  const doc = Number(params.get('doc')) || undefined;
  return (
    <>
      <Cabecalho eyebrow="Projeto e escopo · take-off" titulo="Quanto o projeto pede, e se bate com a planilha" />
      {!doc && <ProjetosTakeoff />}
      <Painel titulo={doc ? 'O que este desenho pede?' : 'Quanto o projeto pede?'}
        subtitulo="Quantidades lidas dos desenhos (DWG/DXF) que chegam em Documentos. Aceite com o item da PQ e a frente, compare com o take-off da planilha e leve ao IWP.">
        <TakeoffProjeto documentoId={doc} />
      </Painel>
    </>
  );
}
