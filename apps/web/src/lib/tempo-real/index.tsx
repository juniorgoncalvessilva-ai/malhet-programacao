'use client';

import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useApi } from '@/hooks/programacao/useApi';
import { useObraOpcional } from '@/lib/obra/ObraProvider';

/**
 * Tempo real: as telas se atualizam sozinhas, com o dado real, sem recarregar a página.
 * - Quem altera: ao salvar, todas as consultas abertas recarregam na hora (useApi chama `recarregarTudo`).
 * - Os outros: a cada 3 s (aba visível) a marca de mudanças da obra (`GET /mudancas`) é conferida; mudou → recarrega.
 * - Deploy novo: a versão do build (`/api/versao`) mudou → recarrega a página (ou avisa, se houver formulário em edição).
 */
const INTERVALO = 3000;
const INTERVALO_VERSAO = 60000;
const VERSAO = process.env.NEXT_PUBLIC_VERSAO ?? '';

/** Recarrega as consultas abertas (as logos ficam: são arquivos que não mudam sem trocar a versão). */
export function recarregarTudo(qc: QueryClient) {
  return qc.invalidateQueries({ predicate: (q) => !q.queryKey.includes('logo') });
}

let marcaConhecida: string | null = null;
export function lembrarMarca(m: string) { marcaConhecida = m; }

function editando() {
  const el = document.activeElement;
  return !!el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function SincronizarDados() {
  const api = useApi();
  const qc = useQueryClient();
  const obraId = useObraOpcional()?.obra?.id;
  const avisado = useRef(false);

  useEffect(() => {
    marcaConhecida = null;
    let vivo = true;
    const conferir = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const { marca } = await api.get<{ marca: string }>('/mudancas');
        if (!vivo) return;
        if (marcaConhecida !== null && marca !== marcaConhecida) recarregarTudo(qc);
        marcaConhecida = marca;
      } catch { /* sem rede ou sessão expirando: tenta de novo no próximo ciclo */ }
    };
    conferir();
    const t = setInterval(conferir, INTERVALO);
    const voltou = () => { if (document.visibilityState === 'visible') conferir(); };
    document.addEventListener('visibilitychange', voltou);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', voltou); };
  }, [api, qc, obraId]);

  useEffect(() => {
    if (!VERSAO) return;
    const conferir = async () => {
      try {
        const r = await fetch('/api/versao', { cache: 'no-store' });
        const { versao } = (await r.json()) as { versao: string };
        if (!versao || versao === VERSAO) return;
        if (!editando()) { window.location.reload(); return; }
        if (avisado.current) return;
        avisado.current = true;
        toast.info('Nova versão da aplicação publicada', { duration: Infinity, action: { label: 'Atualizar agora', onClick: () => window.location.reload() } });
      } catch { /* offline */ }
    };
    const t = setInterval(conferir, INTERVALO_VERSAO);
    const voltou = () => { if (document.visibilityState === 'visible') conferir(); };
    document.addEventListener('visibilitychange', voltou);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', voltou); };
  }, []);
  return null;
}
