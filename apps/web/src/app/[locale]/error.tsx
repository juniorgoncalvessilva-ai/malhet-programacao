'use client';

import { FalhaTela } from '@/components/Erros/FalhaTela';

/** Páginas públicas (início, login, privacidade, portal dos líderes) — spec 141: chunk de build antigo recarrega, sem rede avisa. */
export default function ErroPublico({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="px-4"><FalhaTela error={error} reset={reset} inicio="/" /></div>;
}
