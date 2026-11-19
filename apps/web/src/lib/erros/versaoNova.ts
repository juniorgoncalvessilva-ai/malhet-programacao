/**
 * Depois de um deploy, a página aberta ainda pede os pedaços (chunks) do build antigo, que não existem mais: "Loading
 * chunk 6910 failed". Não é defeito — é versão nova no ar. A resposta é recarregar a página uma vez (spec 109); só se
 * falhar de novo logo em seguida vira relato de erro.
 */
const CHAVE = 'malhet.recarga-versao';
const PADRAO = /Loading (CSS )?chunk [\w-]+ failed|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export const ehVersaoVelha = (e: { message?: string; name?: string } | string | null | undefined) => {
  const t = typeof e === 'string' ? e : `${e?.name ?? ''} ${e?.message ?? ''}`;
  return PADRAO.test(t);
};

/** Recarrega a página se não recarregou por isso no último minuto. Devolve true quando vai recarregar. */
export function recarregarParaVersaoNova(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const antes = Number(sessionStorage.getItem(CHAVE) ?? 0);
    if (Date.now() - antes < 60_000) return false; // já tentou: o erro é real, deixa relatar
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch { /* sem storage: recarrega assim mesmo */ }
  window.location.reload();
  return true;
}
