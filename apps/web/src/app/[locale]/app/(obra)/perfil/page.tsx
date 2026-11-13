'use client';

import { Cabecalho, Painel } from '@/components/Obra/ui';
import { FormPerfil } from '@/components/Perfil/FormPerfil';
import { MeuMenu } from '@/components/Perfil/MeuMenu';

/** Meu perfil (spec 075): foto, nome, telefone e o meu menu de baixo do celular nesta obra. */
export default function PerfilPage() {
  return (
    <>
      <Cabecalho eyebrow="Conta" titulo="Meu perfil" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Painel titulo="Dados da conta"><FormPerfil /></Painel>
        <div className="max-w-[520px]"><MeuMenu /></div>
      </div>
    </>
  );
}
