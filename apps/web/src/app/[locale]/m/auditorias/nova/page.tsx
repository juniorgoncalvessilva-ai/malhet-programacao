'use client';

import { FormAuditoria } from '@/components/Auditoria/FormAuditoria';
import { TopoM } from '@/components/Mobile/ui';

/** Nova auditoria pelo celular (spec 064): modelo padrão de Segurança, fotos com carimbo e envio pelo WhatsApp. */
export default function NovaAuditoriaCampo() {
  return (
    <>
      <TopoM titulo="Nova auditoria" sub="Notificação, interdição, inspeção ou N3" voltar="/m/auditorias" />
      <FormAuditoria />
    </>
  );
}
