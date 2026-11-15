'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { PedraCubica } from '@/components/Marca/PedraCubica';
import { Link } from '@/i18n/navigation';
import { emAppNativo } from '@/lib/presenca/leitores';

/**
 * Moldura das telas de acesso (spec 092): à esquerda a marca — a pedra bruta que vira pedra cúbica, a assinatura
 * "O que foi decidido, fica." e um registro de obra passando, como no RDO; à direita só o formulário, sem enfeite.
 */
const FUNDO = '#0D1A1B', AGUA = '#6FB3B1';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const REGISTRO = [
  ['07:00', 'Guindaste previsto não chegou.'],
  ['07:05', 'Ocorrência registrada em campo.'],
  ['07:12', 'Atividade entregue ao planejamento.'],
  ['07:40', 'Validado · engenheiro de produção.'],
] as const;

function Registro() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % REGISTRO.length), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <ol className="flex flex-col gap-2 text-[13px]" style={{ fontFamily: MONO }} aria-label="Registro de obra (exemplo)">
      {REGISTRO.map(([h, t], k) => (
        <li key={h} className="flex gap-4 transition-all duration-700" style={{ opacity: k === i ? 1 : k < i ? 0.45 : 0.18, color: k === i ? '#fff' : '#9FB9B9' }}>
          <span style={{ color: k === i ? AGUA : undefined }}>{h}</span><span>{t}</span>
        </li>
      ))}
    </ol>
  );
}

export function TelaAuth({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  const [nativo, setNativo] = useState(false); // no app das lojas não leva ao site
  useEffect(() => { setNativo(emAppNativo()); }, []);
  return (
    <div className="grid min-h-screen bg-m-surface-base lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden text-white lg:block" style={{ background: FUNDO }}>
        <PedraCubica tema="escuro" escala={0.2} deslocX={0.18} deslocY={-0.14} className="absolute inset-0 h-full w-full" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="Malhet — página principal"><img src="/brand/malhet-escuro.svg" alt="Malhet" className="h-[22px] w-auto" /></Link>
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/45" style={{ fontFamily: MONO }}>( Acesso )</span>
          </div>
          <div className="flex flex-col gap-10">
            <p className="leading-[0.95] tracking-[-0.04em]" style={{ fontSize: 'clamp(44px, 5vw, 76px)' }}>
              <span className="block font-light">O que foi decidido,</span>
              <span className="block font-extrabold" style={{ color: AGUA }}>fica.</span>
            </p>
            <div className="border-t border-white/15 pt-6"><Registro /></div>
          </div>
        </div>
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Link href="/" aria-label="Malhet — página principal" className="lg:hidden">
            <img src="/brand/malhet.svg" alt="Malhet" className="h-[22px] w-auto dark:hidden" />
            <img src="/brand/malhet-escuro.svg" alt="Malhet" className="hidden h-[22px] w-auto dark:block" />
          </Link>
          {!nativo && <Link href="/" className="text-[12px] font-medium uppercase tracking-[0.14em] text-m-text-muted hover:text-m-text-primary">Conhecer o Malhet ↗</Link>}
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="flex w-full max-w-[400px] flex-col gap-7">
            <div className="flex flex-col gap-2">
              <h1 className="text-[44px] font-light leading-[1] tracking-[-0.03em] text-m-text-primary">{titulo}</h1>
              {subtitulo && <p className="text-[15px] text-m-text-tertiary">{subtitulo}</p>}
            </div>
            {children}
          </div>
        </div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-m-text-muted lg:hidden" style={{ fontFamily: MONO }}>O que foi decidido, fica.</p>
      </main>
    </div>
  );
}
