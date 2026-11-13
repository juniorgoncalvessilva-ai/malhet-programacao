'use client';

import { useEffect } from 'react';
import { useApi } from '@/hooks/programacao/useApi';
import '@/lib/auditorias/fila';
import '@/lib/preventivos';
import { useObra } from '@/lib/obra/ObraProvider';
import { itensDaFila, processarFila } from '@/lib/offline/fila';

/** Telas do campo que precisam abrir sem internet (spec 072): o service worker guarda a página e os arquivos dela. */
const TELAS_OFFLINE = ['/m', '/m/vigente', '/m/lancar', '/m/presenca', '/m/ocorrencias', '/m/ocorrencias/nova', '/m/restricoes',
  '/m/auditorias', '/m/auditorias/nova', '/m/acoes', '/m/preventivos'];

/** Uma vez por dia (e a cada versão do app), com internet, pede ao service worker para guardar as telas do campo. */
function aquecerTelas() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || navigator.onLine === false) return;
  const idioma = window.location.pathname.split('/')[1] || 'pt-BR';
  const chave = `${new Date().toISOString().slice(0, 10)}:${process.env.NEXT_PUBLIC_VERSAO ?? ''}`;
  try { if (localStorage.getItem('malhet.telas-offline') === chave) return; } catch { /* sem localStorage */ }
  navigator.serviceWorker.ready.then((r) => {
    r.active?.postMessage({ tipo: 'aquecer', urls: TELAS_OFFLINE.map((u) => `/${idioma}${u}`) });
    try { localStorage.setItem('malhet.telas-offline', chave); } catch { /* ok */ }
  }).catch(() => undefined);
}

/** Sobe a fila de registros do campo (auditoria, etilômetro…) quando houver internet: ao abrir, ao voltar a rede e a cada 30 s. */
export function SincronizarFila() {
  const api = useApi();
  const obraId = useObra().obra?.id;
  useEffect(() => {
    if (!obraId || typeof indexedDB === 'undefined') return;
    const post = api.post as <T>(p: string, b: unknown) => Promise<T>;
    const tentar = async () => {
      if (navigator.onLine === false) return;
      try { if ((await itensDaFila(obraId)).some((x) => x.estado === 'pendente')) await processarFila(post, obraId); } catch { /* depois */ }
    };
    tentar();
    if (window.location.pathname.includes('/m')) setTimeout(aquecerTelas, 4000); // depois que a tela atual carregou
    window.addEventListener('online', tentar);
    const t = setInterval(tentar, 30000);
    return () => { window.removeEventListener('online', tentar); clearInterval(t); };
  }, [obraId]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
