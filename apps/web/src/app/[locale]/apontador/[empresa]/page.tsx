'use client';

import { useParams } from 'next/navigation';
import { PortalLider } from '@/components/PortalLider/PortalLider';

/** Spec 147: `/apontador/<empresa>` — a marca da empresa antes do login; entram só as matrículas das obras dela. */
export default function ApontadorDaEmpresaPage() {
  const { empresa } = useParams<{ empresa: string }>();
  return <PortalLider perfil="apontador" rota={{ empresa }} />;
}
