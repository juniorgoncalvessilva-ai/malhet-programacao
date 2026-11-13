'use client';

import { useEffect } from 'react';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import { pendentes, sincronizar } from '@/lib/presenca/offline';

/** Em qualquer tela do app de campo: sobe a fila de presença guardada no celular quando houver internet (spec 063). */
export function SincronizarPresenca() {
  const api = useApi();
  const obraId = useObra().obra?.id;
  useEffect(() => {
    if (!obraId || typeof indexedDB === 'undefined') return;
    const post = api.post as <T>(p: string, b: unknown) => Promise<T>;
    const tentar = async () => {
      if (navigator.onLine === false) return;
      try { if ((await pendentes(obraId)).length) await sincronizar(post, obraId); } catch { /* tenta depois */ }
    };
    tentar();
    window.addEventListener('online', tentar);
    const t = setInterval(tentar, 30000);
    return () => { window.removeEventListener('online', tentar); clearInterval(t); };
  }, [obraId]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
