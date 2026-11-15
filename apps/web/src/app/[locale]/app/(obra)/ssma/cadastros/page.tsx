'use client';

import { useState } from 'react';
import { CadastrosSsma } from '@/components/Obra/CadastroSsma';
import { Abas } from '@/components/Obra/Abas';
import { Cabecalho } from '@/components/Obra/ui';
import { FichaColaborador } from '@/components/Efetivo/FichaColaborador';
import { AbaAsos, AbaExigencias, AbaMatriz, AbaMetricas, AbaTreinamentos } from '@/components/Treinamentos/Abas';
import { useObra } from '@/lib/obra/ObraProvider';

type Aba = 'metricas' | 'asos' | 'treinamentos' | 'exigencias' | 'matriz' | 'cadastros';

/** Cadastros de SSMA (spec 012) + ASOs e treinamentos (spec 088): métricas, ASOs, catálogo, exigência por função e matriz. */
export default function CadastrosSsmaPage() {
  const { editaSsma } = useObra();
  const [aba, setAba] = useState<Aba>('metricas');
  const [ficha, setFicha] = useState<number | null>(null);
  return (
    <>
      <Cabecalho eyebrow="Segurança · cadastros de SSMA" cor="var(--m-proc-administrar)" titulo="ASOs, treinamentos e cadastros de SSMA" />
      <Abas rotulo="Seções de SSMA" ativa={aba} onTrocar={setAba} abas={[
        { chave: 'metricas', titulo: 'Métricas' }, { chave: 'asos', titulo: 'ASOs' }, { chave: 'treinamentos', titulo: 'Treinamentos' },
        { chave: 'exigencias', titulo: 'Exigência por função' }, { chave: 'matriz', titulo: 'Matriz pessoa × treinamento' },
        { chave: 'cadastros', titulo: 'Técnicos, RAC, PTS, ART e ATA' },
      ]} />
      {aba === 'metricas' && <AbaMetricas onFicha={setFicha} />}
      {aba === 'asos' && <AbaAsos podeEditar={editaSsma} onFicha={setFicha} />}
      {aba === 'treinamentos' && <AbaTreinamentos podeEditar={editaSsma} />}
      {aba === 'exigencias' && <AbaExigencias podeEditar={editaSsma} />}
      {aba === 'matriz' && <AbaMatriz onFicha={setFicha} />}
      {aba === 'cadastros' && <CadastrosSsma tipos={['TECNICO', 'RAC', 'PTS', 'ART', 'ATA']} podeEditar={editaSsma} titulo="O que a segurança pode escolher em cada linha?" />}
      {ficha && <FichaColaborador id={ficha} onFechar={() => setFicha(null)} />}
    </>
  );
}
