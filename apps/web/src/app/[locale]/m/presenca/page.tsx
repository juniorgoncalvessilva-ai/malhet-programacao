'use client';

import { PainelLeitura } from '@/components/Presenca/PainelLeitura';
import { usePresenca } from '@/lib/presenca/usePresenca';

/** Apropriação de presença no campo (spec 063): o painel de leitura com a conta do Malhet. */
export default function PresencaPage() {
  return <PainelLeitura pr={usePresenca()} />;
}
