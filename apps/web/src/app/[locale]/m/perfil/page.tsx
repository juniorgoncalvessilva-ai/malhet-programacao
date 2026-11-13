'use client';

import { TopoM, cartaoM } from '@/components/Mobile/ui';
import { FormPerfil } from '@/components/Perfil/FormPerfil';
import { MeuMenu } from '@/components/Perfil/MeuMenu';

/** Meu perfil no celular (spec 075): foto, nome e o meu menu de baixo. */
export default function PerfilCampo() {
  return (
    <>
      <TopoM titulo="Meu perfil" voltar="/m" />
      <section className={cartaoM}><FormPerfil /></section>
      <MeuMenu />
    </>
  );
}
