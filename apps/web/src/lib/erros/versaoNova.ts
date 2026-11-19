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

const VERSAO = process.env.NEXT_PUBLIC_VERSAO ?? '';

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

/** Versão do build que está no ar agora (null sem rede). */
export async function versaoNoAr(): Promise<string | null> {
  try {
    const r = await fetch('/api/versao', { cache: 'no-store' });
    return ((await r.json()) as { versao?: string }).versao || null;
  } catch { return null; }
}

/** Esta aba é de um build antigo? (só dá para saber quando o build tem versão) */
export async function abaDeVersaoAntiga(): Promise<boolean> {
  if (!VERSAO) return false;
  const noAr = await versaoNoAr();
  return !!noAr && noAr !== VERSAO;
}

/**
 * Chunk que falhou (spec 113): se a aba é de um build antigo, recarrega — sem relato, é deploy (até 3 vezes em 5 min,
 * para nunca entrar em ciclo); senão, a recarga única por minuto. Devolve true quando vai recarregar.
 */
export async function tratarVersaoVelha(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (await abaDeVersaoAntiga()) {
    try {
      const k = 'malhet.recargas-deploy';
      const recentes = (JSON.parse(sessionStorage.getItem(k) ?? '[]') as number[]).filter((t) => Date.now() - t < 300_000);
      if (recentes.length < 3) {
        sessionStorage.setItem(k, JSON.stringify([...recentes, Date.now()]));
        window.location.reload();
        return true;
      }
    } catch { window.location.reload(); return true; }
  }
  return recarregarParaVersaoNova();
}
