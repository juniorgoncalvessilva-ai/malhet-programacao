'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';

/** A associação cronograma ↔ WBS agora é feita na própria WBS de execução (spec 084): este endereço leva para lá. */
export default function AssociacaoPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/app/wbs?associar=1'); }, [router]);
  return <p className="text-sm text-m-text-muted">Abrindo a WBS de execução…</p>;
}
