/**
 * Skeleton loading (spec 085): no lugar de "Carregando…", o formato do que vai aparecer, pulsando — a tela parece pronta
 * mais cedo e o usuário não fica olhando texto parado. Respeita `prefers-reduced-motion` (sem pulsar).
 */
const base = 'animate-pulse rounded-[6px] bg-m-surface-active motion-reduce:animate-none';

/** Uma barra (inline: cabe dentro de parágrafo/célula). */
export function Esqueleto({ className = 'h-4 w-32' }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block ${base} ${className}`} />;
}

/** Bloco genérico de carregamento (substitui o parágrafo "Carregando…"). */
export function Carregando({ linhas = 4, className = '' }: { linhas?: number; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label="Carregando" className={`flex flex-col gap-2.5 py-1 ${className}`}>
      {Array.from({ length: linhas }, (_, i) => (
        <span key={i} className={`block h-4 ${base}`} style={{ width: `${[92, 78, 85, 64, 88, 70][i % 6]}%` }} />
      ))}
    </div>
  );
}

/** Linhas de tabela pulsando (dentro de <tbody>). */
export function LinhasCarregando({ colunas, linhas = 6 }: { colunas: number; linhas?: number }) {
  return (
    <>
      {Array.from({ length: linhas }, (_, r) => (
        <tr key={r} aria-hidden="true" className="border-b border-m-row">
          {Array.from({ length: colunas }, (_, c) => (
            <td key={c} className="px-3 py-3"><span className={`block h-3.5 ${base}`} style={{ width: `${c === 1 ? 85 : [60, 75, 50, 68][(r + c) % 4]}%` }} /></td>
          ))}
        </tr>
      ))}
      <tr className="sr-only"><td role="status">Carregando</td></tr>
    </>
  );
}

/** Página inteira (rota carregando): cabeçalho, indicadores e uma tabela. */
export function PaginaCarregando() {
  return (
    <div role="status" aria-label="Carregando a tela" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2"><Esqueleto className="h-3 w-40" /><Esqueleto className="h-8 w-72" /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-m-carimbo border border-m-stroke-subtle bg-m-surface-raised px-4 py-3">
            <Esqueleto className="h-3 w-24" /><Esqueleto className="h-6 w-16" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-m-xl border border-m-stroke-subtle bg-m-surface-raised p-5">
        <Esqueleto className="h-5 w-56" />
        <table className="w-full"><tbody><LinhasCarregando colunas={5} linhas={8} /></tbody></table>
      </div>
    </div>
  );
}

/** Celular: cartões empilhados. */
export function CampoCarregando() {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-3 pt-2">
      <Esqueleto className="h-7 w-48" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-2 rounded-[16px] border border-m-stroke-subtle bg-m-surface-raised p-4">
          <Esqueleto className="h-4 w-3/4" /><Esqueleto className="h-3 w-1/2" /><Esqueleto className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
