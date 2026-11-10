'use client';

import { AcessosDaObra } from '@/components/Obra/Acessos';
import { Cabecalho } from '@/components/Obra/ui';
import { useObra } from '@/lib/obra/ObraProvider';

export default function AcessosPage() {
  const { obra, pode } = useObra();
  if (!obra) return null;
  return (
    <>
      <Cabecalho
        eyebrow="Administrar · acessos da obra"
        cor="var(--m-proc-administrar)"
        titulo={`Quem trabalha na ${obra.nome} e o que cada um pode fazer`}
        descricao="O admin da obra libera e-mails, escolhe o papel e informa o crachá do Simova dos encarregados. Quem sai da obra perde o acesso na hora."
      />
      {pode('admin')
        ? <AcessosDaObra obraId={obra.id} obraNome={obra.nome} />
        : <p className="text-sm text-m-text-muted">Só o admin da obra gerencia acessos.</p>}
    </>
  );
}
