'use client';

import { useParams } from 'next/navigation';
import { PortalLider } from '@/components/PortalLider/PortalLider';

/** Link dos líderes da obra (spec 111): aberto pelo grupo do WhatsApp, sem conta do Malhet. */
export default function EquipeDoLiderPage() {
  const { codigo } = useParams<{ codigo: string }>();
  return <PortalLider codigo={codigo} />;
}
