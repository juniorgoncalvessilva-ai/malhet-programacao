'use client';

import { useParams } from 'next/navigation';
import { PortalLider } from '@/components/PortalLider/PortalLider';

/** Spec 147: `/apontador/<empresa>/<obra>` — o endereço do apontador sai do cadastro, como o do encarregado. */
export default function ApontadorDaObraPage() {
  const { empresa, obra } = useParams<{ empresa: string; obra: string }>();
  return <PortalLider perfil="apontador" rota={{ empresa, obra }} />;
}
