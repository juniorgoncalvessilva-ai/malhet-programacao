'use client';

import { useParams } from 'next/navigation';
import { PortalLider } from '@/components/PortalLider/PortalLider';

/** Spec 117: `/encarregado/<empresa>/<obra>` — a obra e a marca dela antes do login; o endereço sai do cadastro. */
export default function EncarregadoDaObraPage() {
  const { empresa, obra } = useParams<{ empresa: string; obra: string }>();
  return <PortalLider rota={{ empresa, obra }} />;
}
