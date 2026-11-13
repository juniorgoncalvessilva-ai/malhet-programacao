'use client';

import { ListaNotificacoes } from '@/components/Notificacoes/Lista';
import { TopoM, cartaoM } from '@/components/Mobile/ui';

/** Notificações no celular (spec 076): toque abre a tela do assunto. */
export default function NotificacoesCampo() {
  return (
    <>
      <TopoM titulo="Notificações" voltar="/m" />
      <section className={cartaoM}><ListaNotificacoes mobile /></section>
    </>
  );
}
