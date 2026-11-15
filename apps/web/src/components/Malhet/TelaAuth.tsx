'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { PedraCubica } from '@/components/Marca/PedraCubica';
import { Link } from '@/i18n/navigation';
import { emAppNativo } from '@/lib/presenca/leitores';

/**
 * Moldura das telas de acesso (specs 092 e 095): à esquerda a marca — a pedra cúbica no centro (gira e segue o mouse),
 * a assinatura "O que foi decidido, fica." e "Na obra agora", episódios curtos de registro que passam um a um (exemplos);
 * à direita só o formulário, sem enfeite.
 */
const FUNDO = '#0D1A1B', AGUA = '#6FB3B1';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
/** Episódios de obra (exemplos): o ocorrido entra, alguém resolve, o Malhet sela. */
const EPISODIOS: { titulo: string; linhas: [string, string][]; selo: string }[] = [
  { titulo: 'Chuva na concretagem', selo: 'Impedimento registrado com foto e hora',
    linhas: [['06:40', 'Chuva forte na frente do bloco B2.'], ['06:42', 'Concretagem suspensa. Foto anexada à ocorrência.'], ['06:50', 'Equipe remanejada para a armação da Área 3.']] },
  { titulo: 'O desenho mudou na véspera', selo: 'Ninguém trabalhou na revisão antiga',
    linhas: [['17:30', 'Revisão C do desenho chega por e-mail.'], ['17:34', 'Restrição aberta para a frente da Área 3.'], ['07:10', 'Planejamento libera a atividade com a revisão nova.']] },
  { titulo: 'Faltou parafuso no pipe rack', selo: 'Ocorrência fechada no mesmo dia',
    linhas: [['10:15', 'Montagem parada: falta parafuso M20.'], ['10:16', 'Suprimentos recebe a atividade com prazo.'], ['13:40', 'Material na frente de serviço.']] },
  { titulo: 'Quem está na obra hoje?', selo: 'A programação já sabe quem chegou',
    linhas: [['06:58', 'Crachás lidos por NFC na entrada do canteiro.'], ['07:02', 'Equipe de forma completa: 9 de 9.'], ['07:05', 'Capacidade do dia recalculada.']] },
  { titulo: 'Segurança antes do turno', selo: 'Assinado pelo colaborador, no celular',
    linhas: [['06:30', 'Etilômetro aferido e dentro da calibração.'], ['06:34', 'Teste do turno aplicado, um por um.'], ['06:41', 'Resultado assinado com crachá ou rosto.']] },
  { titulo: 'Fim do mês, medição', selo: 'O BMM sai do que foi validado',
    linhas: [['18:00', 'Itens executados com quem validou e quando.'], ['18:05', 'Desvios com causa e responsável.'], ['18:10', 'Medição montada a partir do registro, não da memória.']] },
  { titulo: 'O guindaste não chegou', selo: 'Validado · engenheiro de produção',
    linhas: [['07:00', 'Guindaste previsto não chegou.'], ['07:05', 'Ocorrência registrada em campo.'], ['07:12', 'Atividade entregue ao planejamento.']] },
];

/** "Na obra agora": cada episódio digita as linhas, uma por vez, e termina com o selo; depois vem outro. */
function NaObra() {
  const [ep, setEp] = useState(0);
  const [passo, setPasso] = useState(0); // 0..linhas (linhas = selo à mostra)
  const [letras, setLetras] = useState(0);
  const e = EPISODIOS[ep];
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPasso(e.linhas.length); setLetras(999); return; }
    const linha = e.linhas[passo];
    if (linha && letras < linha[1].length) { const t = setTimeout(() => setLetras((l) => l + 2), 22); return () => clearTimeout(t); }
    const espera = passo < e.linhas.length ? 650 : 2600;
    const t = setTimeout(() => {
      if (passo < e.linhas.length) { setPasso((p) => p + 1); setLetras(0); }
      else { setEp((x) => (x + 1) % EPISODIOS.length); setPasso(0); setLetras(0); }
    }, espera);
    return () => clearTimeout(t);
  }, [ep, passo, letras, e]);
  return (
    <div aria-live="polite">
      <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO }}>
        <span className="flex items-center gap-2 text-white/55"><span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: AGUA }} />Na obra agora · {e.titulo}</span>
        <span className="flex gap-1" aria-hidden="true">
          {EPISODIOS.map((_, k) => <span key={k} className="h-1 w-3 rounded-full transition-colors" style={{ background: k === ep ? AGUA : 'rgba(255,255,255,.15)' }} />)}
        </span>
      </div>
      <ol key={ep} className="flex min-h-[132px] flex-col gap-2 text-[13.5px]" style={{ fontFamily: MONO }}>
        {e.linhas.map(([h, t], k) => k <= passo && k < e.linhas.length && (
          <li key={k} className="flex gap-4" style={{ color: k === passo ? '#fff' : '#9FB9B9', opacity: k === passo ? 1 : 0.6 }}>
            <span style={{ color: k === passo ? AGUA : undefined }}>{h}</span>
            <span>{k === passo ? t.slice(0, letras) : t}{k === passo && letras < t.length && <span className="ml-px inline-block h-[13px] w-[7px] translate-y-[2px] animate-pulse" style={{ background: AGUA }} />}</span>
          </li>
        ))}
        {passo >= e.linhas.length && (
          <li className="m-carimbo mt-4 inline-flex w-fit items-center gap-3 rounded-[8px] border-2 px-3 py-1.5" style={{ borderColor: AGUA, color: AGUA }}>
            <b className="tracking-[0.16em]">SELADO</b><span className="text-white/80">{e.selo}</span>
          </li>
        )}
      </ol>
    </div>
  );
}

export function TelaAuth({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  const [nativo, setNativo] = useState(false); // no app das lojas não leva ao site
  useEffect(() => { setNativo(emAppNativo()); }, []);
  return (
    <div className="grid min-h-screen bg-m-surface-base lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden text-white lg:block" style={{ background: FUNDO }}>
        <div className="relative flex h-full flex-col p-12">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="Malhet — página principal"><img src="/brand/malhet-escuro.svg" alt="Malhet" className="h-[22px] w-auto" /></Link>
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/45" style={{ fontFamily: MONO }}>( Acesso )</span>
          </div>
          {/* a pedra no centro da metade da marca: gira e acompanha o mouse */}
          <div className="relative -mx-12 min-h-[260px] flex-1">
            <PedraCubica tema="escuro" escala={0.47} className="absolute inset-0 h-full w-full" />
          </div>
          <div className="flex flex-col gap-8">
            <p className="leading-[0.95] tracking-[-0.04em]" style={{ fontSize: 'clamp(40px, 4.4vw, 68px)' }}>
              <span className="font-light">O que foi decidido, </span>
              <span className="font-extrabold" style={{ color: AGUA }}>fica.</span>
            </p>
            <div className="border-t border-white/15 pt-6"><NaObra /></div>
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
