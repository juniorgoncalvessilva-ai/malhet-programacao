'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PortalLider } from '@/components/PortalLider/PortalLider';

/**
 * Endereço fixo dos encarregados (spec 115): `/encarregado` — sem link por obra. Entra com a matrícula; o primeiro
 * acesso é aqui mesmo. `?obra=` (vindo de um link antigo) só adianta a marca da empresa na abertura.
 */
function Portal() {
  const obra = Number(useSearchParams().get('obra')) || null;
  return <PortalLider obraInicial={obra} />;
}

export default function EncarregadoPage() {
  return <Suspense fallback={null}><Portal /></Suspense>;
}
