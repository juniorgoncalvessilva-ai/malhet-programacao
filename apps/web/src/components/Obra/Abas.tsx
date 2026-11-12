'use client';

/** Abas de uma página (Ações | Painel | Importar…): só organização, cada aba mostra uma parte da tela. */
export function Abas<T extends string>({ abas, ativa, onTrocar, rotulo }: {
  abas: { chave: T; titulo: string; visivel?: boolean }[]; ativa: T; onTrocar: (a: T) => void; rotulo: string;
}) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex flex-wrap gap-1 border-b border-m-stroke-subtle">
      {abas.filter((a) => a.visivel !== false).map((a) => (
        <button key={a.chave} type="button" role="tab" aria-selected={ativa === a.chave} onClick={() => onTrocar(a.chave)}
          className={`-mb-px border-b-2 px-4 py-2.5 text-[13.5px] font-semibold ${ativa === a.chave ? 'border-m-accent text-m-accent' : 'border-transparent text-m-text-secondary hover:text-m-text-primary'}`}>{a.titulo}</button>
      ))}
    </div>
  );
}
