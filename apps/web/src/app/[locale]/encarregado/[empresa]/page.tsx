'use client';

import { useParams } from 'next/navigation';
import { PortalLider } from '@/components/PortalLider/PortalLider';

/** Spec 117: `/encarregado/<empresa>` — a marca da empresa antes do login; entram só as matrículas das obras dela. */
export default function EncarregadoDaEmpresaPage() {
  const { empresa } = useParams<{ empresa: string }>();
  return <PortalLider rota={{ empresa }} />;
}
