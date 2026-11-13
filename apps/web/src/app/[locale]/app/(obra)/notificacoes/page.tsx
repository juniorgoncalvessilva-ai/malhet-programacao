'use client';

import { ListaNotificacoes } from '@/components/Notificacoes/Lista';
import { Cabecalho, Painel } from '@/components/Obra/ui';

/** Central de notificações (spec 076). */
export default function NotificacoesPage() {
  return (
    <>
      <Cabecalho eyebrow="Conta" titulo="Notificações" />
      <Painel titulo="Alertas da obra para você"><ListaNotificacoes /></Painel>
    </>
  );
}
