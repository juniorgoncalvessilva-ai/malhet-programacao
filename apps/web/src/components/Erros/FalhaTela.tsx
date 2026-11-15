'use client';

import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { relatarErro, type AvisoErro } from '@/lib/erros/relatar';
import { FormComentario } from './Relatos';

/**
 * Tela que quebrou (error.tsx do Next, spec 098): relata sozinha, mostra o código e deixa tentar de novo — sem a tela
 * branca e sem a pessoa precisar descrever o erro.
 */
export function FalhaTela({ error, reset, inicio }: { error: Error & { digest?: string }; reset: () => void; inicio: string }) {
  const [aviso, setAviso] = useState<AvisoErro | null>(null);
  const [contou, setContou] = useState(false);
  useEffect(() => {
    setAviso(relatarErro({ tipo: 'tela', mensagem: error.message || 'A tela não abriu', pilha: [error.stack, error.digest && `digest ${error.digest}`].filter(Boolean).join('\n') }));
  }, [error]);
  return (
    <div className="mx-auto my-10 flex w-full max-w-md flex-col gap-4 rounded-m-xl border border-m-stroke-subtle bg-m-surface-raised p-6 text-m-text-primary">
      <span className="text-[11px] font-semibold uppercase tracking-[0.48px] text-m-text-muted">Algo não saiu como devia</span>
      <h1 className="text-[22px] font-semibold leading-7">Esta tela não conseguiu abrir</h1>
      <p className="text-[14px] text-m-text-tertiary">
        A equipe Malhet já recebeu o aviso{aviso ? <> (código <b className="text-m-text-primary">{aviso.codigo}</b>)</> : ''}. Seus dados salvos não foram perdidos.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-full bg-m-accent-strong px-4 text-[13px] font-semibold text-m-on-accent">
          <RotateCcw size={15} aria-hidden="true" /> Tentar de novo
        </button>
        <a href={inicio} className="inline-flex h-10 items-center rounded-full border border-m-stroke px-4 text-[13px] font-semibold text-m-text-secondary hover:bg-m-surface-hover">Voltar ao início</a>
      </div>
      {aviso && (contou
        ? <p className="text-[13px] text-m-success">Obrigado — seu relato foi junto com o erro.</p>
        : <div className="border-t border-m-stroke-subtle pt-4"><FormComentario idLocal={aviso.idLocal} autoFoco={false} onEnviado={() => setContou(true)} /></div>)}
    </div>
  );
}
