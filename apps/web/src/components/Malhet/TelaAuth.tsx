'use client';

import type { ReactNode } from 'react';

/** Moldura das telas de acesso (BR03 do canvas Malhet): marca à esquerda, formulário à direita. */
export function TelaAuth({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-m-surface-base lg:grid-cols-[1.05fr_1fr]">
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: 'linear-gradient(150deg, #284E4F 0%, #1F3D3E 55%, #142829 100%)' }}
      >
        <img src="/brand/malhet-escuro.svg" alt="Malhet" className="h-7 w-auto self-start" />
        <div className="flex max-w-md flex-col gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.48px] text-[#9FD0CE]">Programação · Simova</span>
          <p className="text-[34px] font-semibold leading-[40px] tracking-[-0.5px]">Planejar, executar e medir a obra num lugar só.</p>
          <p className="text-[15px] leading-6 text-[#C8DCDC]">
            A programação da semana sai do cronograma vigente, respeita a capacidade de cada equipe e volta para o Simova sem digitar de novo.
          </p>
        </div>
        <span className="text-xs text-[#9FB9B9]">feito com Malhet</span>
      </aside>
      <main className="flex items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-[400px] flex-col gap-6">
          <img src="/brand/malhet.svg" alt="Malhet" className="h-6 w-auto self-start dark:hidden lg:hidden" />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.4px]">{titulo}</h1>
            {subtitulo && <p className="text-sm text-m-text-tertiary">{subtitulo}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
