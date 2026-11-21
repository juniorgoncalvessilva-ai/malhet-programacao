'use client';

import dynamic from 'next/dynamic';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { momentoDaFoto } from '@/components/Mobile/Fotos';

// o Excalidraw é pesado: só carrega quando a pessoa toca em "Marcar" (e o service worker guarda para usar offline)
const Editor = dynamic(() => import('./MarcarFotoEditor'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-[300] grid place-items-center bg-black text-[14px] text-white">Abrindo a marcação…</div>,
});

/**
 * Botão de lápis numa foto ainda não enviada (spec 122): abre a marcação por cima da tela e devolve a foto marcada,
 * mantendo o momento em que foi tirada (para o carimbo de data e hora).
 */
export function BotaoMarcar({ foto, onMarcada, className = '' }: { foto: Blob; onMarcada: (b: Blob) => void; className?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" aria-label="Marcar na foto" title="Marcar na foto: circular, apontar, escrever" onClick={() => setAberto(true)}
        className={`grid h-7 w-7 place-items-center rounded-full bg-m-accent-strong text-m-on-accent shadow ${className}`}>
        <Pencil size={13} />
      </button>
      {aberto && typeof document !== 'undefined' && createPortal(
        <Editor foto={foto} onFechar={() => setAberto(false)} onPronto={(b) => {
          const quando = momentoDaFoto.get(foto);
          if (quando) momentoDaFoto.set(b, quando);
          setAberto(false);
          onMarcada(b);
        }} />,
        document.body,
      )}
    </>
  );
}
