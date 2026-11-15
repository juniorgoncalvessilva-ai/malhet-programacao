'use client';

import { FalhaTela } from '@/components/Erros/FalhaTela';

export default function ErroApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <FalhaTela error={error} reset={reset} inicio="/app/vigente" />;
}
