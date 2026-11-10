'use client';

import { useEffect, useState } from 'react';
import { Botao, Campo } from '@/components/Obra/ui';
import { TelaAuth } from '@/components/Malhet/TelaAuth';
import { Link } from '@/i18n/navigation';
import { useSessao } from '@/lib/auth/AuthProvider';

/** Confirmação de e-mail do auth-kit: /auth/verificar?token=… ou colando o token recebido por e-mail. */
export default function VerificarPage() {
  const { verificarEmail } = useSessao();
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState<{ texto: string; ok: boolean } | null>(null);

  const confirmar = (t: string) =>
    verificarEmail(t.trim())
      .then((m) => setMsg({ texto: m, ok: true }))
      .catch((e: Error) => setMsg({ texto: e.message, ok: false }));

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    if (t) confirmar(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TelaAuth titulo="Confirmar e-mail" subtitulo="Cole o token que chegou no seu e-mail.">
      {!msg?.ok && (
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); confirmar(token); }}>
          <Campo rotulo="Token" required value={token} onChange={(e) => setToken(e.target.value)} />
          <Botao type="submit" className="h-11 w-full">Confirmar</Botao>
        </form>
      )}
      {msg && (
        <p className={`rounded-m-md px-4 py-3 text-sm ${msg.ok ? 'bg-m-accent-subtle text-m-accent' : 'bg-m-danger-subtle text-m-danger'}`}>{msg.texto}</p>
      )}
      <Link href="/auth/entrar" className="text-[13px] font-semibold text-m-accent">Ir para o login</Link>
    </TelaAuth>
  );
}
