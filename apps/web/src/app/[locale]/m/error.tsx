'use client';

import { FalhaTela } from '@/components/Erros/FalhaTela';

export default function ErroCampo({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="px-4"><FalhaTela error={error} reset={reset} inicio="/m" /></div>;
}
